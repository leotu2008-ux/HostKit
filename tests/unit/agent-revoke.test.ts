import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.findUnique },
    accountToken: { findFirst: mocks.findFirst },
  },
}));

import { apiUser } from "@/lib/api/http";
import { TOKEN_TTL_SECONDS, issueToken } from "@/lib/api/token";

const SECRET = "test-secret-for-revoke";
const ISSUED_AT = Date.UTC(2026, 8, 24, 12, 0, 0);

function account(sessionVersion = 2) {
  return {
    id: "user_1",
    name: "Sam",
    email: "sam@babson.edu",
    schoolDomain: null,
    classYear: null,
    bio: null,
    company: null,
    xHandle: null,
    linkedinHandle: null,
    instagramHandle: null,
    imageUrl: null,
    phone: null,
    phoneVerifiedAt: null,
    emailVerifiedAt: new Date("2026-01-01"),
    approvedAt: new Date("2026-01-02"),
    sessionVersion,
  };
}

function requestWith(token: string) {
  return new Request("https://tryhosty.app/api/v1/events", {
    headers: { authorization: `Bearer ${token}` },
  });
}

/** A token from before `iat` existed. Issue time is recovered from `exp`. */
function legacyToken(issuedAt: number) {
  const exp = Math.floor(issuedAt / 1000) + TOKEN_TTL_SECONDS;
  const body = Buffer.from(JSON.stringify({ sub: "user_1", exp, v: 2 })).toString("base64url");
  const signature = createHmac("sha256", `hostkit-api:${SECRET}`).update(body).digest("base64url");
  return `${body}.${signature}`;
}

describe("revoked agent tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = SECRET;
    mocks.findUnique.mockResolvedValue(account());
  });

  it("rejects a token issued before the revoke cutoff", async () => {
    const token = issueToken("user_1", 2, ISSUED_AT);
    mocks.findFirst.mockResolvedValue({ usedAt: new Date(ISSUED_AT + 1_000) });
    expect(await apiUser(requestWith(token))).toBeNull();
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user_1", kind: "agent-revoke" }),
      }),
    );
  });

  it("rejects a legacy token with no iat once agent access is revoked", async () => {
    mocks.findFirst.mockResolvedValue({ usedAt: new Date(ISSUED_AT + 1_000) });
    expect(await apiUser(requestWith(legacyToken(ISSUED_AT)))).toBeNull();
  });

  it("accepts a token issued after the cutoff", async () => {
    const revokedAt = new Date(ISSUED_AT + 1_000);
    const token = issueToken("user_1", 2, revokedAt.getTime() + 5_000);
    mocks.findFirst.mockResolvedValue({ usedAt: revokedAt });
    await expect(apiUser(requestWith(token))).resolves.toMatchObject({ id: "user_1" });
  });

  it("accepts a token when agent access has not been revoked", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const token = issueToken("user_1", 2, ISSUED_AT);
    await expect(apiUser(requestWith(token))).resolves.toMatchObject({ id: "user_1" });
  });
});
