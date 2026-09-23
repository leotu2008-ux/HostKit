import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collabFind: vi.fn(),
  collabFindFirst: vi.fn(),
  collabUpdate: vi.fn(),
  collabCreate: vi.fn(),
  eventFind: vi.fn(),
  listingFind: vi.fn(),
  vendorFindFirst: vi.fn(),
  vendorCreate: vi.fn(),
  vendorUpsert: vi.fn(),
  vendorFindMany: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  // The transaction client reuses the top-level mocks where that mirrors
  // the real tx usage (rememberCollaborator's eventCollaborator.findUnique/
  // update and vendorContact.findFirst/create, addVendorToEvent's
  // eventCollaborator.findFirst/create), plus $executeRaw for the per-host
  // advisory lock and $queryRaw for the event row lock.
  const tx = {
    $executeRaw: mocks.executeRaw,
    $queryRaw: mocks.queryRaw,
    eventCollaborator: {
      findUnique: mocks.collabFind,
      findFirst: mocks.collabFindFirst,
      update: mocks.collabUpdate,
      create: mocks.collabCreate,
    },
    vendorContact: { findFirst: mocks.vendorFindFirst, create: mocks.vendorCreate },
  };
  return {
    db: {
      eventCollaborator: {
        findUnique: mocks.collabFind,
        findFirst: mocks.collabFindFirst,
        update: mocks.collabUpdate,
        create: mocks.collabCreate,
      },
      event: { findUnique: mocks.eventFind },
      listing: { findUnique: mocks.listingFind },
      vendorContact: {
        findFirst: mocks.vendorFindFirst,
        create: mocks.vendorCreate,
        upsert: mocks.vendorUpsert,
        findMany: mocks.vendorFindMany,
      },
      $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    },
  };
});

import { addVendorToEvent, rememberBookedListing, rememberCollaborator } from "@/lib/vendor-book";

beforeEach(() => vi.clearAllMocks());

const COLLAB = {
  id: "col-1",
  kind: "VENUE",
  name: "The Foundry",
  email: "hi@foundry.com",
  phone: null,
  website: "https://foundry.com",
  vendorContactId: null,
  event: { ownerId: "host-1" },
};

describe("rememberCollaborator", () => {
  it("adds a confirmed venue to the host's vendor book and links it", async () => {
    mocks.collabFind.mockResolvedValue(COLLAB);
    mocks.vendorFindFirst.mockResolvedValue(null);
    mocks.vendorCreate.mockResolvedValue({ id: "v-1" });

    await rememberCollaborator("col-1");

    expect(mocks.vendorCreate.mock.calls[0][0].data).toMatchObject({
      ownerId: "host-1",
      kind: "VENUE",
      name: "The Foundry",
      email: "hi@foundry.com",
      website: "https://foundry.com",
    });
    expect(mocks.collabUpdate).toHaveBeenCalledWith({ where: { id: "col-1" }, data: { vendorContactId: "v-1" } });
  });

  it("reuses an existing entry with the same kind and name, ignoring case", async () => {
    mocks.collabFind.mockResolvedValue({ ...COLLAB, name: "the foundry" });
    mocks.vendorFindFirst.mockResolvedValue({ id: "v-old" });

    await rememberCollaborator("col-1");

    expect(mocks.vendorCreate).not.toHaveBeenCalled();
    const where = mocks.vendorFindFirst.mock.calls[0][0].where;
    expect(where).toEqual({ ownerId: "host-1", kind: "VENUE", name: { equals: "the foundry", mode: "insensitive" } });
    expect(mocks.collabUpdate).toHaveBeenCalledWith({ where: { id: "col-1" }, data: { vendorContactId: "v-old" } });
  });

  it("does nothing when the event has no owner", async () => {
    mocks.collabFind.mockResolvedValue({ ...COLLAB, event: { ownerId: null } });
    await rememberCollaborator("col-1");
    expect(mocks.vendorCreate).not.toHaveBeenCalled();
    expect(mocks.collabUpdate).not.toHaveBeenCalled();
  });

  it("takes the per-host lock before looking up the book", async () => {
    mocks.collabFind.mockResolvedValue(COLLAB);
    mocks.vendorFindFirst.mockResolvedValue(null);
    mocks.vendorCreate.mockResolvedValue({ id: "v-1" });

    await rememberCollaborator("col-1");

    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.vendorFindFirst.mock.invocationCallOrder[0],
    );
  });

  it("does nothing if the collaborator was linked while waiting for the lock", async () => {
    mocks.collabFind
      .mockResolvedValueOnce(COLLAB) // pre-lock lookup: not linked yet
      .mockResolvedValueOnce({ vendorContactId: "v-9" }); // in-tx re-read: someone else won the race

    await rememberCollaborator("col-1");

    expect(mocks.vendorFindFirst).not.toHaveBeenCalled();
    expect(mocks.vendorCreate).not.toHaveBeenCalled();
    expect(mocks.collabUpdate).not.toHaveBeenCalled();
  });
});

describe("rememberBookedListing", () => {
  it("upserts one entry per host and listing", async () => {
    mocks.eventFind.mockResolvedValue({ ownerId: "host-1" });
    mocks.listingFind.mockResolvedValue({ id: "lst-1", name: "Sol Catering", category: "CATERING" });

    await rememberBookedListing("evt-1", "lst-1");

    expect(mocks.vendorUpsert).toHaveBeenCalledWith({
      where: { ownerId_listingId: { ownerId: "host-1", listingId: "lst-1" } },
      create: { ownerId: "host-1", listingId: "lst-1", name: "Sol Catering", category: "CATERING" },
      update: {},
    });
  });
});

describe("addVendorToEvent", () => {
  it("adds a hand-entered vendor as a pending collaborator linked to the book", async () => {
    mocks.vendorFindFirst.mockResolvedValue({
      id: "v-1",
      kind: "SPEAKER",
      name: "Dr. Lee",
      email: "lee@x.com",
      phone: null,
      website: null,
      listingId: null,
    });
    mocks.collabFindFirst.mockResolvedValue(null);

    expect(await addVendorToEvent("evt-2", "host-1", "v-1")).toBe(true);
    expect(mocks.vendorFindFirst.mock.calls[0][0].where).toEqual({ id: "v-1", ownerId: "host-1" });
    expect(mocks.collabCreate.mock.calls[0][0].data).toMatchObject({
      eventId: "evt-2",
      kind: "SPEAKER",
      name: "Dr. Lee",
      email: "lee@x.com",
      status: "PENDING",
      vendorContactId: "v-1",
    });
  });

  it("refuses another host's entry and catalog entries", async () => {
    mocks.vendorFindFirst.mockResolvedValue(null);
    expect(await addVendorToEvent("evt-2", "host-1", "v-foreign")).toBe(false);
    mocks.vendorFindFirst.mockResolvedValue({ id: "v-2", kind: null, name: "Sol", listingId: "lst-1" });
    expect(await addVendorToEvent("evt-2", "host-1", "v-2")).toBe(false);
    expect(mocks.collabCreate).not.toHaveBeenCalled();
  });

  it("skips, and returns false, when the event already has this vendor as a collaborator", async () => {
    mocks.vendorFindFirst.mockResolvedValue({
      id: "v-1",
      kind: "SPEAKER",
      name: "Dr. Lee",
      email: "lee@x.com",
      phone: null,
      website: null,
      listingId: null,
    });
    mocks.collabFindFirst.mockResolvedValue({ id: "col-existing" });

    expect(await addVendorToEvent("evt-2", "host-1", "v-1")).toBe(false);
    expect(mocks.collabFindFirst.mock.calls[0][0].where).toEqual({ eventId: "evt-2", vendorContactId: "v-1" });
    expect(mocks.collabCreate).not.toHaveBeenCalled();
  });

  it("locks the event row before checking for an existing collaborator", async () => {
    mocks.vendorFindFirst.mockResolvedValue({
      id: "v-1",
      kind: "SPEAKER",
      name: "Dr. Lee",
      email: null,
      phone: null,
      website: null,
      listingId: null,
    });
    mocks.collabFindFirst.mockResolvedValue(null);

    expect(await addVendorToEvent("evt-2", "host-1", "v-1")).toBe(true);

    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.queryRaw.mock.calls[0].slice(1)).toEqual(["evt-2"]);
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.collabFindFirst.mock.invocationCallOrder[0],
    );
    expect(mocks.collabFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.collabCreate.mock.invocationCallOrder[0],
    );
  });
});
