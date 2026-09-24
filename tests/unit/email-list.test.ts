import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailSendError } from "@/lib/email/send";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  sendEmails: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { emailListEntry: { upsert: mocks.upsert } },
}));

vi.mock("@/lib/email/send", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/send")>("@/lib/email/send");
  return {
    ...actual,
    sendEmails: mocks.sendEmails,
  };
});

import { joinEmailList } from "@/lib/email-list";

const ENV_KEYS = [
  "VERCEL_ENV",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
] as const;

function productionTransport() {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "Hosty <mail@mail.tryhosty.app>");
}

beforeEach(() => {
  mocks.upsert.mockReset().mockResolvedValue({});
  mocks.sendEmails.mockReset().mockResolvedValue(1);
  for (const key of ENV_KEYS) vi.stubEnv(key, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("joinEmailList", () => {
  it("records the address and sends a confirmation in production", async () => {
    productionTransport();
    await expect(joinEmailList({ name: "Avery Lane", email: "Avery@Example.com" })).resolves.toEqual({
      email: "avery@example.com",
    });

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { email: "avery@example.com" },
      create: { email: "avery@example.com", name: "Avery Lane" },
      update: { name: "Avery Lane" },
    });
    expect(mocks.sendEmails).toHaveBeenCalledWith([
      {
        to: "avery@example.com",
        subject: "Thanks for joining the Hosty waitlist",
        text: ["Hi Avery,", "", "Thanks for joining the waitlist! We’ll keep you posted whenever updates happen."].join(
          "\n",
        ),
        template: "product_waitlist",
      },
    ]);
  });

  it("refuses when the confirmation cannot be delivered", async () => {
    productionTransport();
    mocks.sendEmails.mockRejectedValue(new EmailSendError(550, "no such user", "smtp"));
    await expect(joinEmailList({ name: "Avery", email: "avery@example.com" })).rejects.toThrow(
      /couldn’t send the confirmation email to avery@example.com/i,
    );
  });

  it("still lists them on a laptop when email is not configured, and does not log the note", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(joinEmailList({ name: "Avery", email: "avery@example.com" })).resolves.toEqual({
      email: "avery@example.com",
    });
    expect(mocks.sendEmails).not.toHaveBeenCalled();
    const line = log.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(line).toContain("product_waitlist");
    expect(line).toContain("avery@example.com");
    expect(line).not.toContain("Thanks for joining");
  });

  it("refuses on preview even when a transport is configured", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM", "Hosty <mail@mail.tryhosty.app>");
    await expect(joinEmailList({ name: "Avery", email: "avery@example.com" })).rejects.toThrow(
      /couldn’t send your confirmation/i,
    );
    expect(mocks.sendEmails).not.toHaveBeenCalled();
  });
});
