import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  deleteEvent: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/db", () => ({ db: { event: { delete: mocks.deleteEvent } } }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));

import { isAdmin } from "@/lib/access";
import { deleteEventAsAdminAction } from "@/lib/actions/admin";

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
