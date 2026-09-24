import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tokenDeleteMany: vi.fn(),
  tokenCreate: vi.fn(),
  transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  sendEmails: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    accountToken: { deleteMany: mocks.tokenDeleteMany, create: mocks.tokenCreate },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/email/send", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/send")>("@/lib/email/send");
  return { ...actual, sendEmails: mocks.sendEmails };
});

import { INVITE_TTL_MS, sendApprovalInvite } from "@/lib/account";

const USER = { id: "u-1", email: "sam@babson.edu", name: "Sam Okafor" };

describe("sendApprovalInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tokenDeleteMany.mockResolvedValue({ count: 0 });
    mocks.tokenCreate.mockResolvedValue({});
    mocks.sendEmails.mockResolvedValue(1);
  });

  it("issues a week-long reset token and emails a set-password link to that address", async () => {
    const before = Date.now();

    await sendApprovalInvite(USER, "https://tryhosty.app");

    expect(mocks.tokenCreate).toHaveBeenCalledTimes(1);
    const { data } = mocks.tokenCreate.mock.calls[0][0];
    expect(data.userId).toBe("u-1");
    expect(data.kind).toBe("reset");
    const expiresInMs = (data.expiresAt as Date).getTime() - before;
    expect(Math.abs(expiresInMs - INVITE_TTL_MS)).toBeLessThan(60_000);

    expect(mocks.sendEmails).toHaveBeenCalledTimes(1);
    const emails = mocks.sendEmails.mock.calls[0][0];
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("sam@babson.edu");
    expect(emails[0].text).toContain("https://tryhosty.app/reset-password?token=");
  });

  it("keeps an invite link valid for a week", () => {
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60_000);
  });
});
