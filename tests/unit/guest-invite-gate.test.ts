import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const smtpSend = vi.hoisted(() => ({
  sendMail: vi.fn(async (_mail: { to: string; text: string; html: string }) => ({ messageId: "ok" })),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: smtpSend.sendMail }),
  },
}));

import { deliverRsvpInvites } from "@/lib/guest-invite-send";
import { resetSmtpTransport } from "@/lib/email/smtp";

const KEYS = [
  "RESEND_API_KEY",
  "RESEND_FROM",
  "RESEND_FROM_BLAST",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "VERCEL_ENV",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  smtpSend.sendMail.mockClear();
  resetSmtpTransport();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

function withGmail() {
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_USER = "someone@gmail.com";
  process.env.SMTP_PASSWORD = "app-password";
  process.env.SMTP_FROM = "Hosty <someone@gmail.com>";
}

const TOKEN = "super-secret-rsvp-token";

function input() {
  return {
    guests: [
      {
        id: "ada",
        name: "Ada Lovelace",
        email: "ada@example.com",
        rsvpToken: TOKEN,
      },
      {
        id: "no-mail",
        name: "No Address",
        email: null,
        rsvpToken: "unused-token",
      },
    ],
    title: "Spring mixer",
    date: new Date(Date.UTC(2026, 5, 15, 23, 30)),
    hostName: "Sam Chen",
    origin: "https://tryhosty.app",
    replyTo: "sam@example.com",
  };
}

describe("RSVP invite delivery gate", () => {
  it("does not send outside production, and does not log the link", async () => {
    process.env.VERCEL_ENV = "preview";
    withGmail();
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message));
    });

    const result = await deliverRsvpInvites(input());

    expect(result).toEqual({ sent: 1, skippedNoEmail: 1 });
    expect(smtpSend.sendMail).not.toHaveBeenCalled();
    const logged = logs.join("\n");
    expect(logged).toContain("rsvp_invite");
    expect(logged).toContain("ada@example.com");
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("https://tryhosty.app/rsvp/");
  });

  it("sends through SMTP in production, still without a budget", async () => {
    process.env.VERCEL_ENV = "production";
    withGmail();

    const result = await deliverRsvpInvites(input());

    expect(result).toEqual({ sent: 1, skippedNoEmail: 1 });
    expect(smtpSend.sendMail).toHaveBeenCalledTimes(1);
    const mail = smtpSend.sendMail.mock.calls[0][0];
    expect(mail.to).toBe("ada@example.com");
    expect(mail.text).toContain(`https://tryhosty.app/rsvp/${TOKEN}`);
    expect(mail.html).toContain(`https://tryhosty.app/rsvp/${TOKEN}`);
    expect(mail.text).toContain("Spring mixer");
    expect(mail.text).toContain("Sam Chen");
    const body = `${mail.text}\n${mail.html}`;
    expect(body).not.toMatch(/budget|\$|cents/);
  });
});
