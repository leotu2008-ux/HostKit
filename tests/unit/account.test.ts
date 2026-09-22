import { describe, expect, it } from "vitest";
import { hashToken, sendFailedMessage, siteOrigin, unverifiedMessage, RESET_TTL_MS, VERIFY_TTL_MS } from "@/lib/account";
import { LIMITS, clientIp } from "@/lib/rate-limit";

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
    process.env.SITE_URL = "https://hostkit.example/";
    try {
      expect(siteOrigin(new Headers({ host: "evil.test" }))).toBe("https://hostkit.example");
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
});
