import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmailSendError, classifyEmailFailure } from "@/lib/email/send";
import { activeTransport, isEmailConfigured } from "@/lib/email/send";
import { asSendError, isSmtpConfigured, smtpPort } from "@/lib/email/smtp";

const KEYS = [
  "RESEND_API_KEY",
  "RESEND_FROM",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function withSmtp() {
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_USER = "someone@gmail.com";
  process.env.SMTP_PASSWORD = "app-password";
  process.env.SMTP_FROM = "Hosty <someone@gmail.com>";
}

function withResend() {
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM = "Hosty <events@example.com>";
}

describe("choosing a transport", () => {
  it("is off when neither is configured", () => {
    expect(isEmailConfigured()).toBe(false);
    expect(activeTransport()).toBeNull();
  });

  it("counts SMTP alone as configured, which is the whole point", () => {
    withSmtp();
    expect(isEmailConfigured()).toBe(true);
    expect(activeTransport()).toBe("smtp");
  });

  it("counts Resend alone as configured", () => {
    withResend();
    expect(isEmailConfigured()).toBe(true);
    expect(activeTransport()).toBe("resend");
  });

  it("prefers Resend when both are set", () => {
    withSmtp();
    withResend();
    expect(activeTransport()).toBe("resend");
  });

  it("needs every SMTP setting before it counts", () => {
    withSmtp();
    delete process.env.SMTP_FROM;
    expect(isSmtpConfigured()).toBe(false);
    expect(isEmailConfigured()).toBe(false);
  });
});

describe("SMTP port", () => {
  it("defaults to 587, the STARTTLS submission port", () => {
    expect(smtpPort()).toBe(587);
  });

  it("takes 465 when asked, for implicit TLS", () => {
    process.env.SMTP_PORT = "465";
    expect(smtpPort()).toBe(465);
  });

  it("ignores nonsense rather than dialling port NaN", () => {
    process.env.SMTP_PORT = "not-a-port";
    expect(smtpPort()).toBe(587);
  });
});

describe("classifying SMTP failures", () => {
  it("blames the server for a rejected login", () => {
    expect(classifyEmailFailure(535, "5.7.8 Username and Password not accepted", "smtp")).toBe("sender");
    expect(classifyEmailFailure(530, "5.7.0 Authentication Required", "smtp")).toBe("sender");
  });

  it("blames the address when the server rejects the recipient", () => {
    expect(classifyEmailFailure(550, "5.1.1 No such user here", "smtp")).toBe("recipient");
    expect(classifyEmailFailure(553, "5.1.3 Bad recipient address syntax", "smtp")).toBe("recipient");
  });

  it("treats a connection that never replied as the server's problem", () => {
    // A blocked port or a wrong host never gets far enough for a reply code.
    expect(classifyEmailFailure(0, "connect ETIMEDOUT", "smtp")).toBe("sender");
  });

  it("does not read SMTP codes as Resend codes", () => {
    // 550 means a bad recipient over SMTP; over HTTP it is not a Resend code
    // at all, and must not be mistaken for one.
    expect(classifyEmailFailure(550, "5.1.1 No such user here", "resend")).toBe("unknown");
  });

  it("wraps a nodemailer error, keeping its reply code and text", () => {
    const error = asSendError({ responseCode: 535, response: "5.7.8 Username and Password not accepted" });
    expect(error).toBeInstanceOf(EmailSendError);
    expect(error.transport).toBe("smtp");
    expect(error.cause).toBe("sender");
    expect(error.message).toContain("SMTP 535");
  });

  it("wraps a connection error that carries no reply code", () => {
    const error = asSendError(new Error("connect ECONNREFUSED 1.2.3.4:587"));
    expect(error.status).toBe(0);
    expect(error.cause).toBe("sender");
  });
});
