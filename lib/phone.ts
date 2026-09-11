import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";

/**
 * A phone number on the account, confirmed with a one-time code. The code
 * lives hashed in PhoneVerification for ten minutes; the number is only
 * written to the user once a code matches.
 */

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_AFTER_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

export class PhoneError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** E.164, assuming the US for bare 10-digit numbers; null when it isn't one. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** "+16175550100" → "(617) 555-0100"; other countries keep the + form, spaced. */
export function formatPhone(e164: string): string {
  if (/^\+1\d{10}$/.test(e164)) {
    return `(${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}`;
  }
  return e164.replace(/(\d{3})(?=\d)/g, "$1 ");
}

export function codeMessage(code: string) {
  return `Your HostKit code is ${code}. It expires in 10 minutes.`;
}

/** Sends a fresh code. Returns the code itself only when there's no SMS
 *  service and this isn't production, so the flow can be walked locally. */
export async function startPhoneVerification(userId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new PhoneError("Enter a phone number with the area code.", 400);

  const taken = await db.user.findFirst({ where: { phone, NOT: { id: userId } }, select: { id: true } });
  if (taken) throw new PhoneError("That number is already on another account.", 409);

  const latest = await db.phoneVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_AFTER_MS) {
    throw new PhoneError("Give it a minute before asking for another code.", 429);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await db.$transaction([
    db.phoneVerification.deleteMany({ where: { userId } }),
    db.phoneVerification.create({
      data: { userId, phone, codeHash: await bcrypt.hash(code, 8), expiresAt },
    }),
  ]);

  const configured = isSmsConfigured();
  if (configured) {
    await sendSms(phone, codeMessage(code));
  } else {
    console.log(`[sms] no Twilio configured — code for ${phone}: ${code}`);
  }
  return {
    phone,
    expiresAt,
    devCode: !configured && process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

/** Checks the code and, if it matches, puts the number on the account. */
export async function confirmPhoneVerification(userId: string, rawCode: string) {
  const code = rawCode.replace(/\D/g, "");
  const row = await db.phoneVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw new PhoneError("That code has expired. Ask for a new one.", 400);
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.phoneVerification.deleteMany({ where: { userId } });
    throw new PhoneError("Too many tries. Ask for a new code.", 429);
  }
  if (code.length !== 6 || !(await bcrypt.compare(code, row.codeHash))) {
    await db.phoneVerification.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw new PhoneError("That code isn't right.", 400);
  }
  try {
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { phone: row.phone, phoneVerifiedAt: new Date() } }),
      db.phoneVerification.deleteMany({ where: { userId } }),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new PhoneError("That number is already on another account.", 409);
    }
    throw error;
  }
  return row.phone;
}

export async function removePhone(userId: string) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { phone: null, phoneVerifiedAt: null } }),
    db.phoneVerification.deleteMany({ where: { userId } }),
  ]);
}
