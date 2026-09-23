import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  entryFind: vi.fn(),
  entryUpdate: vi.fn(),
  userFind: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  userDelete: vi.fn(),
  invite: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    emailListEntry: { findUnique: mocks.entryFind, update: mocks.entryUpdate },
    user: { findUnique: mocks.userFind, create: mocks.userCreate, update: mocks.userUpdate, delete: mocks.userDelete },
  },
}));
vi.mock("@/lib/account", async () => {
  const actual = await vi.importActual<typeof import("@/lib/account")>("@/lib/account");
  return { ...actual, sendApprovalInvite: mocks.invite };
});

import { approveWaitlistEntry } from "@/lib/waitlist-approval";

const ENTRY = { id: "wl-1", email: "sam@babson.edu", name: "Sam Okafor", approvedAt: null, userId: null };

describe("approveWaitlistEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invite.mockResolvedValue({});
    mocks.userCreate.mockImplementation(async ({ data }) => ({ id: "u-new", ...data }));
    mocks.userUpdate.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      email: ENTRY.email,
      name: ENTRY.name,
      ...data,
    }));
    mocks.userDelete.mockResolvedValue({});
  });

  it("creates the user from the entry's stored, normalized email, approves both rows and sends one invite", async () => {
    mocks.entryFind.mockResolvedValue(ENTRY);
    mocks.userFind.mockResolvedValue(null);

    const result = await approveWaitlistEntry("wl-1", "https://tryhosty.app");

    const created = mocks.userCreate.mock.calls[0][0].data;
    expect(created.email).toBe("sam@babson.edu");
    expect(created.name).toBe("Sam Okafor");
    expect(created.approvedAt).toBeUndefined();
    expect(typeof created.passwordHash).toBe("string");
    expect(mocks.invite).toHaveBeenCalledTimes(1);
    expect(mocks.invite.mock.calls[0][1]).toBe("https://tryhosty.app");
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "u-new" },
      data: { approvedAt: expect.any(Date) },
    });
    expect(mocks.entryUpdate).toHaveBeenCalledWith({
      where: { id: "wl-1" },
      data: { approvedAt: expect.any(Date), userId: "u-new" },
    });
    expect(result).toEqual({ email: "sam@babson.edu", alreadyApproved: false });
  });

  it("approves an existing user row instead of creating a duplicate", async () => {
    mocks.entryFind.mockResolvedValue(ENTRY);
    mocks.userFind.mockResolvedValue({ id: "u-old", email: ENTRY.email, name: ENTRY.name, approvedAt: null });

    await approveWaitlistEntry("wl-1", "https://tryhosty.app");

    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: "u-old" }, data: { approvedAt: expect.any(Date) } });
    expect(mocks.entryUpdate.mock.calls[0][0].data.userId).toBe("u-old");
    expect(mocks.invite).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for an entry that is already approved", async () => {
    mocks.entryFind.mockResolvedValue({ ...ENTRY, approvedAt: new Date("2026-09-20"), userId: "u-old" });

    const result = await approveWaitlistEntry("wl-1", "https://tryhosty.app");

    expect(result).toEqual({ email: "sam@babson.edu", alreadyApproved: true });
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.entryUpdate).not.toHaveBeenCalled();
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it("refuses an unknown entry", async () => {
    mocks.entryFind.mockResolvedValue(null);
    await expect(approveWaitlistEntry("nope", "https://tryhosty.app")).rejects.toThrow("not on the waitlist");
    expect(mocks.invite).not.toHaveBeenCalled();
  });

  it("leaves the entry pending when the invite fails, so Let in can retry", async () => {
    mocks.entryFind.mockResolvedValue(ENTRY);
    mocks.userFind.mockResolvedValue(null);
    mocks.invite.mockRejectedValue(new Error("smtp down"));

    await expect(approveWaitlistEntry("wl-1", "https://tryhosty.app")).rejects.toThrow("smtp down");

    expect(mocks.userCreate).toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.entryUpdate).not.toHaveBeenCalled();
    // This call created the user, so the half-made row is rolled back —
    // nothing is left behind for a retry to mistake for a real signup.
    expect(mocks.userDelete).toHaveBeenCalledWith({ where: { id: "u-new" } });
  });

  it("never deletes a user that already existed when the invite fails", async () => {
    mocks.entryFind.mockResolvedValue(ENTRY);
    mocks.userFind.mockResolvedValue({ id: "u-old", email: ENTRY.email, name: ENTRY.name, approvedAt: null });
    mocks.invite.mockRejectedValue(new Error("smtp down"));

    await expect(approveWaitlistEntry("wl-1", "https://tryhosty.app")).rejects.toThrow("smtp down");

    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.entryUpdate).not.toHaveBeenCalled();
    expect(mocks.userDelete).not.toHaveBeenCalled();
  });
});
