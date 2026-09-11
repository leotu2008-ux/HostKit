import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/api/token";
import { requestOwnsDraft } from "@/lib/api/drafts";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function apiError(message: string, status: number) {
  return json({ error: message }, status);
}

/** Parses a JSON body, or null when there isn't a valid one. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** The user behind a `Authorization: Bearer` token, or null. */
export async function apiUser(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const payload = verifyToken(match[1]);
  if (!payload) return null;
  return db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, schoolDomain: true, classYear: true, bio: true, imageUrl: true, phone: true, phoneVerifiedAt: true },
  });
}

export type ApiUserRow = NonNullable<Awaited<ReturnType<typeof apiUser>>>;

/**
 * An event this request may manage: one the signed-in user owns, or a draft
 * the device made and still holds the token for. Null otherwise, so callers
 * answer 404 and never confirm that someone else's event exists.
 */
export async function manageableEvent(
  request: Request,
  eventId: string,
  userId: string | null,
) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  if (userId && event.ownerId === userId) return event;
  if (requestOwnsDraft(request, event)) return event;
  return null;
}
