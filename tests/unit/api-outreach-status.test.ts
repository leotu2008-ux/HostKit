import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  rememberCollaborator: vi.fn(),
  record: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { eventCollaborator: { updateMany: mocks.updateMany, findFirst: mocks.findFirst } },
}));

vi.mock("@/lib/api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/http")>();
  return {
    ...actual,
    apiUser: vi.fn(async () => ({ id: "u1", name: "Maya" })),
    manageableEvent: vi.fn(async () => ({ id: "e1", ownerId: "u1" })),
  };
});

vi.mock("@/lib/api/outreach", () => ({ loadOutreach: vi.fn(async () => []) }));

vi.mock("@/lib/vendor-book", () => ({ rememberCollaborator: mocks.rememberCollaborator }));

vi.mock("@/lib/activity", () => ({ record: mocks.record }));

import { PATCH } from "@/app/api/v1/events/[id]/outreach/[rowId]/route";

function patch(status: string) {
  return PATCH(
    new Request("http://localhost/api/v1/events/e1/outreach/c1", {
      method: "PATCH",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }),
    { params: Promise.resolve({ id: "e1", rowId: "c1" }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.findFirst.mockResolvedValue({ kind: "VENUE", name: "The Loft", status: "PENDING" });
  mocks.record.mockResolvedValue(undefined);
  mocks.rememberCollaborator.mockResolvedValue(undefined);
});

describe("PATCH /api/v1/events/:id/outreach/:rowId", () => {
  it("puts a confirmed venue, speaker or cohost in the host's vendor book, like the web does", async () => {
    const res = await patch("CONFIRMED");
    expect(res.status).toBe(200);
    expect(mocks.rememberCollaborator).toHaveBeenCalledWith("c1");
  });

  it("leaves the vendor book alone for other statuses", async () => {
    await patch("DECLINED");
    await patch("PENDING");
    expect(mocks.rememberCollaborator).not.toHaveBeenCalled();
  });

  it("still answers 200 when the vendor book write fails", async () => {
    mocks.rememberCollaborator.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await patch("CONFIRMED");
    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  it("doesn't touch the vendor book for a row on another event", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const res = await patch("CONFIRMED");
    expect(res.status).toBe(404);
    expect(mocks.rememberCollaborator).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("writes the same thread line as the web when a row moves into CONFIRMED", async () => {
    await patch("CONFIRMED");
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1", eventId: "e1" } }),
    );
    expect(mocks.record).toHaveBeenCalledWith("e1", {
      actor: "host",
      kind: "collaborator_confirmed",
      title: "Venue confirmed: The Loft",
    });
  });

  it("writes no thread line for a row that was already confirmed, or for other statuses", async () => {
    mocks.findFirst.mockResolvedValue({ kind: "COHOST", name: "Sam", status: "CONFIRMED" });
    await patch("CONFIRMED");
    mocks.findFirst.mockResolvedValue({ kind: "COHOST", name: "Sam", status: "PENDING" });
    await patch("DECLINED");
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
