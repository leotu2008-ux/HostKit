import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  deleteEvent: vi.fn(),
  refresh: vi.fn(),
  approve: vi.fn(),
  headers: vi.fn(async () => new Headers({ host: "tryhosty.app", "x-forwarded-proto": "https" })),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/db", () => ({ db: { event: { delete: mocks.deleteEvent } } }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/waitlist-approval", () => ({ approveWaitlistEntry: mocks.approve }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));

import { isAdmin } from "@/lib/access";
import { AccountError } from "@/lib/account";
import { approveWaitlistEntryAction, deleteEventAsAdminAction } from "@/lib/actions/admin";

const ADMIN = { id: "u-admin", email: "leowomc@gmail.com", name: "Leo" };
const MAYA = { id: "u-maya", email: "maya@hostkit.demo", name: "Maya Chen" };

function form(eventId: string) {
  const data = new FormData();
  data.set("eventId", eventId);
  return data;
}

describe("isAdmin", () => {
  it("is only the administrator's exact address", () => {
    expect(isAdmin({ email: "leowomc@gmail.com" })).toBe(true);
    expect(isAdmin({ email: " LeoWomc@Gmail.com " })).toBe(true);
    expect(isAdmin({ email: "maya@hostkit.demo" })).toBe(false);
    expect(isAdmin({ email: "leowomc@gmail.com.evil.com" })).toBe(false);
  });
});

describe("deleteEventAsAdminAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteEvent.mockResolvedValue({});
  });

  it("deletes the event when the administrator asks", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    await deleteEventAsAdminAction(form("evt-1"));
    expect(mocks.deleteEvent).toHaveBeenCalledWith({ where: { id: "evt-1" } });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses anyone who is not the administrator, Maya included", async () => {
    mocks.currentUser.mockResolvedValue(MAYA);
    await expect(deleteEventAsAdminAction(form("evt-1"))).rejects.toThrow();
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
  });

  it("refuses a signed-out caller", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(deleteEventAsAdminAction(form("evt-1"))).rejects.toThrow();
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
  });

  it("refuses a request with no event id", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    await expect(deleteEventAsAdminAction(form(""))).rejects.toThrow();
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
  });
});

describe("approveWaitlistEntryAction", () => {
  function entryForm(entryId: string) {
    const data = new FormData();
    data.set("entryId", entryId);
    return data;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.approve.mockResolvedValue({ email: "sam@babson.edu", alreadyApproved: false });
    mocks.headers.mockResolvedValue(new Headers({ host: "tryhosty.app", "x-forwarded-proto": "https" }));
  });

  it("approves the entry when the administrator asks, linking back to this site", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    const result = await approveWaitlistEntryAction(undefined, entryForm("wl-1"));
    expect(mocks.approve).toHaveBeenCalledWith("wl-1", "https://tryhosty.app");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("returns the account error's message instead of crashing when the invite can't go out", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    mocks.approve.mockRejectedValue(new AccountError("Email isn't set up yet.", 503));
    const result = await approveWaitlistEntryAction(undefined, entryForm("wl-1"));
    expect(result).toEqual({ error: "Email isn't set up yet." });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("hides raw provider text behind a generic retry message", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    mocks.approve.mockRejectedValue(new Error("resend: 422 invalid api key re_abc123"));
    const result = await approveWaitlistEntryAction(undefined, entryForm("wl-1"));
    expect(result).toEqual({ error: "Could not send the invite. Try again in a moment." });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("refuses anyone who is not the administrator", async () => {
    mocks.currentUser.mockResolvedValue(MAYA);
    await expect(approveWaitlistEntryAction(undefined, entryForm("wl-1"))).rejects.toThrow();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("refuses a request with no entry id", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    await expect(approveWaitlistEntryAction(undefined, entryForm(""))).rejects.toThrow();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("prefers SITE_URL over the request's own host, so a preview build can't email an unusable link", async () => {
    process.env.SITE_URL = "https://tryhosty.app";
    mocks.headers.mockResolvedValue(new Headers({ host: "preview-abc.vercel.app", "x-forwarded-proto": "https" }));
    try {
      mocks.currentUser.mockResolvedValue(ADMIN);
      await approveWaitlistEntryAction(undefined, entryForm("wl-1"));
      expect(mocks.approve).toHaveBeenCalledWith("wl-1", "https://tryhosty.app");
    } finally {
      delete process.env.SITE_URL;
    }
  });
});
