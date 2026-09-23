import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tokenFind: vi.fn(),
  tokenUpdate: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    accountToken: { findUnique: mocks.tokenFind, update: mocks.tokenUpdate },
    user: { update: mocks.userUpdate },
  },
}));

import { resetPassword } from "@/lib/account";

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tokenFind.mockResolvedValue({
      id: "t-1",
      userId: "u-1",
      kind: "reset",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mocks.tokenUpdate.mockResolvedValue({});
    mocks.userUpdate.mockResolvedValue({ email: "sam@babson.edu" });
  });

  it("marks the address verified when a reset link is used", async () => {
    await expect(resetPassword("raw-token", "a-long-password")).resolves.toBe("sam@babson.edu");
    const { where, data } = mocks.userUpdate.mock.calls[0][0];
    expect(where).toEqual({ id: "u-1" });
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(data.sessionVersion).toEqual({ increment: 1 });
  });
});
