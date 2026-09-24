import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOT_DELIVERABLE_MESSAGE,
  hashToken,
  requestPasswordReset,
  sendApprovalInvite,
  sendBlockedMessage,
  sendFailedMessage,
  siteOrigin,
  unverifiedMessage,
  verificationDeliverable,
  RESET_TTL_MS,
  VERIFY_TTL_MS,
} from "@/lib/account";
import { LIMITS, clientIp } from "@/lib/rate-limit";

const dbMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  deleteMany: vi.fn(async () => ({ count: 0 })),
  create: vi.fn(async () => ({})),
  transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: dbMocks.findUnique },
    accountToken: { deleteMany: dbMocks.deleteMany, create: dbMocks.create },
    $transaction: dbMocks.transaction,
  },
}));

describe("account tokens", () => {
  it("hashes tokens one way and consistently", () => {
    const a = hashToken("abc");
    expect(a).toHaveLength(64);
    expect(a).toBe(hashToken("abc"));
    expect(a).not.toBe(hashToken("abd"));
    expect(a).not.toContain("abc");
  });

  it("keeps reset links short-lived and verification links a day", () => {
    expect(RESET_TTL_MS).toBe(60 * 60_000);
    expect(VERIFY_TTL_MS).toBe(24 * 60 * 60_000);
  });

  it("prefers SITE_URL for links when it is set", () => {
    process.env.SITE_URL = "https://hosty.example/";
    try {
      expect(siteOrigin(new Headers({ host: "evil.test" }))).toBe("https://hosty.example");
    } finally {
      delete process.env.SITE_URL;
    }
  });

  it("builds links from the request's own origin", () => {
    expect(siteOrigin(new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }))).toBe("http://localhost:3000");
    expect(siteOrigin(new Headers({ "x-forwarded-host": "tryhosty.app", host: "internal" }))).toBe(
      "https://tryhosty.app",
    );
  });
});

describe("rate limits", () => {
  it("reads the caller's address from the proxy header", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers())).toBe("local");
  });

  it("caps password guessing harder per address than per email", () => {
    expect(LIMITS.signIn.perEmail[0]).toBeLessThan(LIMITS.signIn.perIp[0]);
    expect(LIMITS.forgot.perEmail[0]).toBe(3);
  });
});

describe("sign-up messages", () => {
  it("says which address failed and that nothing was kept", () => {
    const message = sendFailedMessage("ada@example.edu");
    expect(message).toContain("ada@example.edu");
    // A person retyping a typo needs to know the address is free again.
    expect(message).toMatch(/wasn.t created/);
  });

  it("tells an unconfirmed account where its link went", () => {
    expect(unverifiedMessage("ada@example.edu")).toContain("ada@example.edu");
  });

  it("names Resend and SMTP when the server cannot send", () => {
    expect(sendBlockedMessage("ada@example.edu")).toContain("Resend");
    expect(sendBlockedMessage("ada@example.edu")).toContain("SMTP");
    expect(NOT_DELIVERABLE_MESSAGE).toContain("RESEND_API_KEY");
    expect(NOT_DELIVERABLE_MESSAGE).toContain("SMTP_HOST");
  });
});

describe("devLink and log hygiene", () => {
  let logs: string[];
  const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

  beforeEach(() => {
    logs = [];
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message));
    });
    dbMocks.findUnique.mockReset();
    dbMocks.deleteMany.mockClear();
    dbMocks.create.mockClear();
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM", "");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    vi.stubEnv("SMTP_FROM", "");
    dbMocks.findUnique.mockResolvedValue({ id: "u-1", name: "Ada Lovelace" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function logged(): string {
    return logs.join("\n");
  }

  it("returns the link on a laptop and does not write it to the log", async () => {
    const result = await requestPasswordReset("Ada@Example.com", "http://localhost:3000");
    expect(result.devLink).toContain("http://localhost:3000/reset-password?token=");
    const token = new URL(result.devLink!).searchParams.get("token");
    expect(token).toBeTruthy();
    expect(logged()).toContain("password_reset");
    expect(logged()).toContain("ada@example.com");
    expect(logged()).not.toContain(token!);
    expect(logged()).not.toContain("reset-password?token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not return the link on preview, and does not call Resend", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM", "Hosty <mail@mail.tryhosty.app>");
    const result = await requestPasswordReset("ada@example.com", "https://tryhosty.app");
    expect(result.devLink).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged()).toContain("password_reset");
    expect(logged()).not.toContain("token=");
  });

  it("sends in production and keeps the link out of the log", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM", "Hosty <mail@mail.tryhosty.app>");
    const result = await requestPasswordReset("ada@example.com", "https://tryhosty.app");
    expect(result.devLink).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1];
    const body = JSON.parse(init.body) as Array<{ text: string }>;
    expect(body[0].text).toContain("reset-password?token=");
    expect(logged()).not.toContain("token=");
  });

  it("refuses a required invite on preview instead of logging the link", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(
      sendApprovalInvite({ id: "u-1", email: "ada@example.com", name: "Ada Lovelace" }, "https://tryhosty.app"),
    ).rejects.toThrow(NOT_DELIVERABLE_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged()).not.toContain("token=");
  });

  it("treats a laptop as able to confirm, and preview as not, even with keys set", () => {
    expect(verificationDeliverable()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM", "Hosty <mail@mail.tryhosty.app>");
    expect(verificationDeliverable()).toBe(false);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(verificationDeliverable()).toBe(true);
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM", "");
    expect(verificationDeliverable()).toBe(false);
  });
});
