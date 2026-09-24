import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailSendError, classifyEmailFailure } from "@/lib/email/send";
import { activeTransport, canDeliverLive, fromAddressFor, isEmailConfigured, sendEmails } from "@/lib/email/send";
import { sendViaResend } from "@/lib/email/resend";
import { stripHeader } from "@/lib/email/headers";
import { asSendError, isLoopbackHost, isSmtpConfigured, resetSmtpTransport, sendViaSmtp, smtpPort } from "@/lib/email/smtp";

const smtpSend = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({ messageId: "ok" })),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: smtpSend.sendMail }),
  },
}));

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

describe("stripHeader", () => {
  it("removes CR and LF so a value cannot become a second header", () => {
    expect(stripHeader("Hello\r\nBcc: evil@example.com")).toBe("HelloBcc: evil@example.com");
    expect(stripHeader("Hello\nWorld")).toBe("HelloWorld");
    expect(stripHeader("Hello\rWorld")).toBe("HelloWorld");
    expect(stripHeader("plain subject")).toBe("plain subject");
  });
});

describe("loopback hosts", () => {
  it("accepts localhost and the IPv4 and IPv6 loopback addresses", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("127.1.2.3")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
  });

  it("rejects a real mail host", () => {
    expect(isLoopbackHost("smtp.gmail.com")).toBe(false);
    expect(isLoopbackHost("")).toBe(false);
    expect(isLoopbackHost(undefined)).toBe(false);
  });
});

describe("live delivery", () => {
  it("is off without a production deployment, even when a transport is configured", () => {
    withResend();
    expect(canDeliverLive()).toBe(false);
    process.env.VERCEL_ENV = "preview";
    expect(canDeliverLive()).toBe(false);
    process.env.VERCEL_ENV = "development";
    expect(canDeliverLive()).toBe(false);
  });

  it("is on only for production with a transport", () => {
    process.env.VERCEL_ENV = "production";
    expect(canDeliverLive()).toBe(false);
    withSmtp();
    expect(canDeliverLive()).toBe(true);
    delete process.env.SMTP_HOST;
    withResend();
    expect(canDeliverLive()).toBe(true);
  });
});

describe("From addresses", () => {
  it("sends transactional mail from RESEND_FROM and blasts from RESEND_FROM_BLAST", () => {
    process.env.RESEND_FROM = "Hosty <mail@mail.tryhosty.app>";
    process.env.RESEND_FROM_BLAST = "Hosty <news@notify.tryhosty.app>";
    expect(fromAddressFor("transactional")).toBe("Hosty <mail@mail.tryhosty.app>");
    expect(fromAddressFor("blast")).toBe("Hosty <news@notify.tryhosty.app>");
  });

  it("keeps blasts on RESEND_FROM until the notify domain exists", () => {
    process.env.RESEND_FROM = "Hosty <mail@mail.tryhosty.app>";
    expect(fromAddressFor("blast")).toBe("Hosty <mail@mail.tryhosty.app>");
  });
});

describe("the delivery gate", () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not call Resend from preview, and does not log the body", async () => {
    process.env.VERCEL_ENV = "preview";
    withResend();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const secret = "https://tryhosty.app/reset-password?token=super-secret-token";
    const sent = await sendEmails([
      {
        to: "ada@example.com",
        subject: "Reset your Hosty password",
        text: secret,
        html: `<a href="${secret}">reset</a>`,
        template: "password_reset",
      },
    ]);
    expect(sent).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(smtpSend.sendMail).not.toHaveBeenCalled();
    const logged = logs.join("\n");
    expect(logged).toContain("password_reset");
    expect(logged).toContain("ada@example.com");
    expect(logged).not.toContain("super-secret-token");
    expect(logged).not.toContain(secret);
  });

  it("does not dial Gmail from preview", async () => {
    process.env.VERCEL_ENV = "preview";
    withSmtp();
    const sent = await sendEmails([
      { to: "ada@example.com", subject: "Hello", text: "body", template: "password_reset" },
    ]);
    expect(sent).toBe(1);
    expect(smtpSend.sendMail).not.toHaveBeenCalled();
  });

  it("sends through Resend in production", async () => {
    process.env.VERCEL_ENV = "production";
    withResend();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const sent = await sendEmails([
      {
        to: "ada@example.com",
        subject: "Hello\r\nBcc: evil@example.com",
        text: "plain",
        html: "<p>plain</p>",
        replyTo: "host@example.com\n",
        headers: { "X-Test": "1\r\nBcc: evil@example.com" },
        template: "password_reset",
      },
    ]);
    expect(sent).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe("https://api.resend.com/emails/batch");
    const body = JSON.parse(init.body) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].to).toEqual(["ada@example.com"]);
    expect(body[0].subject).toBe("HelloBcc: evil@example.com");
    expect(body[0].text).toBe("plain");
    expect(body[0].html).toBe("<p>plain</p>");
    expect(body[0].reply_to).toBe("host@example.com");
    expect(body[0].headers).toEqual({ "X-Test": "1Bcc: evil@example.com" });
    expect(body[0].from).toBe("Hosty <events@example.com>");
    expect(smtpSend.sendMail).not.toHaveBeenCalled();
  });

  it("sends through SMTP in production, including the html part", async () => {
    process.env.VERCEL_ENV = "production";
    withSmtp();
    const sent = await sendEmails([
      {
        to: "ada@example.com",
        subject: "Hello",
        text: "plain",
        html: "<p>plain</p>",
      },
    ]);
    expect(sent).toBe(1);
    expect(smtpSend.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ada@example.com",
        subject: "Hello",
        text: "plain",
        html: "<p>plain</p>",
      }),
    );
  });

  it("still delivers to a loopback catcher when live delivery is off", async () => {
    withSmtp();
    process.env.SMTP_HOST = "127.0.0.1";
    const sent = await sendEmails([{ to: "ada@example.com", subject: "Hello", text: "plain" }]);
    expect(sent).toBe(1);
    expect(smtpSend.sendMail).toHaveBeenCalledTimes(1);
  });
});

describe("Resend message shape", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fetchMock(): ReturnType<typeof vi.fn> {
    return fetch as unknown as ReturnType<typeof vi.fn>;
  }

  it("posts one address per message and an Idempotency-Key when given", async () => {
    withResend();
    process.env.RESEND_FROM_BLAST = "Hosty <news@notify.tryhosty.app>";
    const sent = await sendViaResend([
      {
        to: "ada@example.com",
        subject: "Hello",
        text: "plain",
        html: "<p>plain</p>",
        stream: "blast",
        idempotencyKey: "blast:1:ada@example.com",
        headers: { "List-Unsubscribe": "<https://tryhosty.app/unsub>" },
      },
      {
        to: "bea@example.com",
        subject: "Hello",
        text: "plain",
      },
    ]);
    expect(sent).toBe(2);
    const calls = fetchMock().mock.calls as Array<[string, { headers: Record<string, string>; body: string }]>;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe("https://api.resend.com/emails");
    expect(calls[0][1].headers["Idempotency-Key"]).toBe("blast:1:ada@example.com");
    const keyed = JSON.parse(calls[0][1].body) as { to: string[]; from: string; html: string };
    expect(keyed.to).toEqual(["ada@example.com"]);
    expect(keyed.from).toBe("Hosty <news@notify.tryhosty.app>");
    expect(keyed.html).toBe("<p>plain</p>");
    expect(calls[1][0]).toBe("https://api.resend.com/emails/batch");
    expect(calls[1][1].headers["Idempotency-Key"]).toBeUndefined();
    const batched = JSON.parse(calls[1][1].body) as Array<{ to: string[] }>;
    expect(batched).toHaveLength(1);
    expect(batched[0].to).toEqual(["bea@example.com"]);
  });

  it("strips a newline out of the From display name", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "Bad\r\nName <mail@mail.tryhosty.app>";
    await sendViaResend([{ to: "ada@example.com", subject: "Hello", text: "plain" }]);
    const init = fetchMock().mock.calls[0][1] as { body: string };
    const body = JSON.parse(init.body) as Array<{ from: string }>;
    expect(body[0].from).toBe("BadName <mail@mail.tryhosty.app>");
  });
});

describe("SMTP refuses a remote host unless live delivery is on", () => {
  it("does not dial Gmail from preview", async () => {
    process.env.VERCEL_ENV = "preview";
    withSmtp();
    await expect(
      sendViaSmtp([{ to: "ada@example.com", subject: "Hello", text: "plain" }]),
    ).rejects.toThrow(/non-loopback/);
    expect(smtpSend.sendMail).not.toHaveBeenCalled();
  });

  it("dials loopback without live delivery, and accepts html", async () => {
    withSmtp();
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_FROM = "Hosty\r\n<catcher@localhost>";
    const sent = await sendViaSmtp([
      {
        to: "ada@example.com",
        subject: "Hello\nthere",
        text: "plain",
        html: "<p>plain</p>",
        replyTo: "host@example.com",
      },
    ]);
    expect(sent).toBe(1);
    expect(smtpSend.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Hosty<catcher@localhost>",
        to: "ada@example.com",
        subject: "Hellothere",
        html: "<p>plain</p>",
        replyTo: "host@example.com",
      }),
    );
  });
});
