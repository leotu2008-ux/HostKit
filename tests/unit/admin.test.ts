import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  deleteEvent: vi.fn(),
  refresh: vi.fn(),
  approve: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/db", () => ({ db: { event: { delete: mocks.deleteEvent } } }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/waitlist-approval", () => ({ approveWaitlistEntry: mocks.approve }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "tryhosty.app", "x-forwarded-proto": "https" }),
}));

import { isAdmin } from "@/lib/access";
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
  });

  it("approves the entry when the administrator asks, linking back to this site", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    await approveWaitlistEntryAction(entryForm("wl-1"));
    expect(mocks.approve).toHaveBeenCalledWith("wl-1", "https://tryhosty.app");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refuses anyone who is not the administrator", async () => {
    mocks.currentUser.mockResolvedValue(MAYA);
    await expect(approveWaitlistEntryAction(entryForm("wl-1"))).rejects.toThrow();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("refuses a request with no entry id", async () => {
    mocks.currentUser.mockResolvedValue(ADMIN);
    await expect(approveWaitlistEntryAction(entryForm(""))).rejects.toThrow();
    expect(mocks.approve).not.toHaveBeenCalled();
  });
});
