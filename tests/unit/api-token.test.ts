import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { issueToken, verifyToken } from "@/lib/api/token";

const KEY = "hostkit-api:test-secret";
const NOW = Date.UTC(2026, 8, 11, 12, 0, 0);
const DAY = 86_400_000;

describe("API bearer tokens", () => {
  it("round-trips the user id", () => {
    const token = issueToken("user_123", 0, NOW, KEY);
    expect(verifyToken(token, NOW, KEY)?.sub).toBe("user_123");
  });

  it("stays valid for 30 days and no longer", () => {
    const token = issueToken("user_123", 0, NOW, KEY);
    expect(verifyToken(token, NOW + 29 * DAY, KEY)).not.toBeNull();
    expect(verifyToken(token, NOW + 30 * DAY, KEY)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = issueToken("user_123", 0, NOW, "hostkit-api:other");
    expect(verifyToken(token, NOW, KEY)).toBeNull();
  });

  it("rejects a payload swapped under an existing signature", () => {
    const token = issueToken("user_123", 0, NOW, KEY);
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "someone_else", exp: NOW / 1000 + DAY }),
    ).toString("base64url");
    expect(verifyToken(`${forged}.${signature}`, NOW, KEY)).toBeNull();
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "abc", "a.b.c", ".sig", "body.", "💥.💥"]) {
      expect(verifyToken(bad, NOW, KEY)).toBeNull();
    }
  });
});

describe("API token versions", () => {
  it("carries the session version it was issued at", () => {
    expect(verifyToken(issueToken("user_123", 3, NOW, KEY), NOW, KEY)?.v).toBe(3);
  });

  it("reads a token from before versions as version 0", () => {
    const body = Buffer.from(JSON.stringify({ sub: "user_123", exp: NOW / 1000 + DAY })).toString("base64url");
    const [, signature] = issueToken("user_123", 0, NOW, KEY).split(".");
    // Same signing key, older payload shape: re-sign the legacy body.
    const legacy = `${body}.${createHmac("sha256", KEY).update(body).digest("base64url")}`;
    expect(signature).toBeTruthy();
    expect(verifyToken(legacy, NOW, KEY)).toEqual({ sub: "user_123", exp: NOW / 1000 + DAY, v: 0 });
  });
});
