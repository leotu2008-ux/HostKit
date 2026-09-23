import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    event: { findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    series: { create: vi.fn() },
    budgetCategory: { createMany: vi.fn() },
    task: { createMany: vi.fn() },
    runSheetItem: { createMany: vi.fn() },
    eventCollaborator: { createMany: vi.fn() },
  };
  return { tx };
});

vi.mock("@/lib/db", () => ({
  db: { $transaction: (fn: (tx: unknown) => unknown) => fn(hoisted.tx) },
}));

import { planRerun, runEventAgain, type RerunSource } from "@/lib/run-again";

const DAY = 86_400_000;
const { tx } = hoisted;

const SOURCE: RerunSource = {
  id: "evt-1",
  ownerId: "host-1",
  seriesId: null,
  title: "Thursday Pitch Night",
  type: "MIXER",
  kind: "pitch night",
  date: new Date("2026-10-01T19:00:00Z"),
  endDate: new Date("2026-10-03T19:00:00Z"),
  datesFlexible: true,
  durationHours: 3,
  guestCount: 60,
  city: "Boston, MA",
  address: "100 Cambridge St",
  lat: 42.36,
  lng: -71.06,
  budgetTotalCents: 150_000,
  vibe: "Loud",
  description: "Five pitches, one winner.",
  ticketType: "FREE",
  ticketPriceCents: 0,
  visibility: "UNLISTED",
  requiresApproval: false,
  coverUrl: null,
  schoolDomain: "babson.edu",
  clubId: null,
  budgetCategories: [{ category: "CATERING", name: "Food", allocatedCents: 90_000, source: "GENERATED" }],
  tasks: [{ title: "Book the room", notes: null, offsetDays: 14, category: "VENUE", source: "GENERATED" }],
  runSheetItems: [
    { startsAt: new Date("2026-10-01T18:30:00Z"), title: "Doors", owner: "Sam", notes: null, source: "GENERATED" },
  ],
  collaborators: [
    {
      kind: "VENUE",
      name: "The Foundry",
      email: "hi@foundry.com",
      phone: null,
      website: null,
      detail: null,
      source: "MANUAL",
      externalId: null,
      lat: null,
      lng: null,
      vendorContactId: "v-1",
    },
  ],
};

describe("planRerun", () => {
  const date = new Date("2026-11-05T19:00:00Z");
  const plan = planRerun(SOURCE, date);

  it("copies the brief onto a new unpublished draft at the new date, pointing back at the source", () => {
    expect(plan.event).toMatchObject({
      ownerId: "host-1",
      title: "Thursday Pitch Night",
      kind: "pitch night",
      date,
      durationHours: 3,
      guestCount: 60,
      city: "Boston, MA",
      budgetTotalCents: 150_000,
      description: "Five pitches, one winner.",
      visibility: "UNLISTED",
      copiedFromId: "evt-1",
    });
    expect(plan.event).not.toHaveProperty("published");
    expect(plan.event).not.toHaveProperty("claimToken");
  });

  it("carries flexible dates over, shifting endDate by the same gap as date", () => {
    expect(plan.event.datesFlexible).toBe(true);
    expect(plan.event.endDate?.toISOString()).toBe("2026-11-07T19:00:00.000Z");
  });

  it("drops endDate when the source had no date or no end", () => {
    const noSourceDate = planRerun({ ...SOURCE, date: null }, date);
    expect(noSourceDate.event.endDate).toBeNull();
    expect(noSourceDate.event.datesFlexible).toBe(true);

    const noEndDate = planRerun({ ...SOURCE, endDate: null }, date);
    expect(noEndDate.event.endDate).toBeNull();
    expect(noEndDate.event.datesFlexible).toBe(true);
  });

  it("copies the budget split and re-dates tasks from their offset", () => {
    expect(plan.budgetCategories).toEqual([
      { category: "CATERING", name: "Food", allocatedCents: 90_000, source: "GENERATED" },
    ]);
    expect(plan.tasks[0]).toMatchObject({ title: "Book the room", offsetDays: 14, status: "TODO" });
    expect(plan.tasks[0].dueDate.getTime()).toBeLessThanOrEqual(date.getTime() - 13 * DAY);
  });

  it("shifts run-sheet items by the gap between the two dates", () => {
    expect(plan.runSheetItems[0].startsAt.toISOString()).toBe("2026-11-05T18:30:00.000Z");
  });

  it("brings vendors back as pending, still linked to the vendor book", () => {
    expect(plan.collaborators[0]).toMatchObject({ kind: "VENUE", name: "The Foundry", status: "PENDING", vendorContactId: "v-1" });
  });

  it("keeps run-sheet times of day when the source had no date", () => {
    const undated = planRerun({ ...SOURCE, date: null }, date);
    const startsAt = undated.runSheetItems[0].startsAt;
    const source = SOURCE.runSheetItems[0].startsAt;
    expect(startsAt.getHours()).toBe(source.getHours());
    expect(startsAt.getMinutes()).toBe(source.getMinutes());
    expect(startsAt.getFullYear()).toBe(date.getFullYear());
    expect(startsAt.getMonth()).toBe(date.getMonth());
    expect(startsAt.getDate()).toBe(date.getDate());
  });
});

describe("runEventAgain", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reuses the source's series instead of creating another", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({ ...SOURCE, seriesId: "series-1" });
    tx.event.create.mockResolvedValue({ id: "evt-new" });

    const id = await runEventAgain("evt-1", new Date("2026-11-05T19:00:00Z"));

    expect(id).toBe("evt-new");
    expect(tx.series.create).not.toHaveBeenCalled();
    expect(tx.event.create.mock.calls[0][0].data.seriesId).toBe("series-1");
  });

  it("locks the source row before reading it, so a double-submit can't race", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue({ ...SOURCE, seriesId: "series-1" });
    tx.event.create.mockResolvedValue({ id: "evt-new" });

    await runEventAgain("evt-1", new Date("2026-11-05T19:00:00Z"));

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.event.findUniqueOrThrow.mock.invocationCallOrder[0],
    );
  });

  it("starts a series named after the event the first time", async () => {
    tx.event.findUniqueOrThrow.mockResolvedValue(SOURCE);
    tx.series.create.mockResolvedValue({ id: "series-new" });
    tx.event.create.mockResolvedValue({ id: "evt-new" });

    await runEventAgain("evt-1", new Date("2026-11-05T19:00:00Z"));

    expect(tx.series.create).toHaveBeenCalledWith({ data: { ownerId: "host-1", name: "Thursday Pitch Night" } });
    expect(tx.event.update).toHaveBeenCalledWith({ where: { id: "evt-1" }, data: { seriesId: "series-new" } });
    expect(tx.event.create.mock.calls[0][0].data.seriesId).toBe("series-new");
  });
});
