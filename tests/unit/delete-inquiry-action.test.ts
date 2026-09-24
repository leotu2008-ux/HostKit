import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  refresh: vi.fn(),
  budgetItemDeleteMany: vi.fn(),
  inquiryDeleteMany: vi.fn(),
  inquiryFindFirst: vi.fn(),
  inquiryUpdate: vi.fn(),
  record: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/activity", () => ({ record: mocks.record }));
vi.mock("@/lib/db", () => {
  const tx = {
    budgetItem: { deleteMany: mocks.budgetItemDeleteMany },
    inquiry: { deleteMany: mocks.inquiryDeleteMany, update: mocks.inquiryUpdate },
    budgetCategory: { findUnique: async () => null },
    task: { updateMany: async () => ({ count: 0 }) },
  };
  return {
    db: {
      inquiry: { findFirst: mocks.inquiryFindFirst },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import { deleteInquiryAction, updateInquiryAction } from "@/lib/actions/inquiries";

function form(eventId: string, inquiryId: string) {
  const data = new FormData();
  data.set("eventId", eventId);
  data.set("inquiryId", inquiryId);
  return data;
}

describe("deleteInquiryAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only touches the budget line and inquiry on the event the host can reach", async () => {
    mocks.requireEvent.mockResolvedValue({ user: { id: "host-1" }, event: { id: "evt-1", ownerId: "host-1" } });

    // An inquiry id from someone else's event, posted against the host's own.
    await deleteInquiryAction(form("evt-1", "inq-on-another-event"));

    expect(mocks.budgetItemDeleteMany).toHaveBeenCalledWith({
      where: { inquiryId: "inq-on-another-event", eventId: "evt-1" },
    });
    expect(mocks.inquiryDeleteMany).toHaveBeenCalledWith({
      where: { id: "inq-on-another-event", eventId: "evt-1" },
    });
  });
});

describe("updateInquiryAction", () => {
  beforeEach(() => vi.clearAllMocks());

  function statusForm(status: string) {
    const data = form("evt-1", "inq-1");
    data.set("status", status);
    return data;
  }

  const booked = {
    id: "inq-1",
    eventId: "evt-1",
    listingId: "lst-1",
    status: "BOOKED",
    quotedCents: 120000,
    message: "Hi",
    sentAt: new Date("2026-09-01T12:00:00Z"),
    respondedAt: new Date("2026-09-02T12:00:00Z"),
    listing: { name: "Corner Kitchen", category: "CATERING" },
  };

  it.each(["QUOTED", "REPLIED", "SENT", "DRAFT", "DECLINED"])(
    "moving a booking back to %s takes its line off this event's budget",
    async (status) => {
      mocks.requireEvent.mockResolvedValue({ user: { id: "host-1" }, event: { id: "evt-1" } });
      mocks.inquiryFindFirst.mockResolvedValue(booked);

      const result = await updateInquiryAction(undefined, statusForm(status));

      expect(result).toBeUndefined();
      expect(mocks.budgetItemDeleteMany).toHaveBeenCalledWith({
        where: { inquiryId: "inq-1", eventId: "evt-1" },
      });
    },
  );

  it("re-saving a booking keeps its line", async () => {
    mocks.requireEvent.mockResolvedValue({ user: { id: "host-1" }, event: { id: "evt-1" } });
    mocks.inquiryFindFirst.mockResolvedValue(booked);

    const result = await updateInquiryAction(undefined, statusForm("BOOKED"));

    expect(result).toBeUndefined();
    expect(mocks.inquiryUpdate).toHaveBeenCalled();
    expect(mocks.budgetItemDeleteMany).not.toHaveBeenCalled();
  });
});
