import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEvent: vi.fn(),
  refresh: vi.fn(),
  budgetItemDeleteMany: vi.fn(),
  inquiryDeleteMany: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireEvent: mocks.requireEvent }));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/db", () => {
  const tx = {
    budgetItem: { deleteMany: mocks.budgetItemDeleteMany },
    inquiry: { deleteMany: mocks.inquiryDeleteMany },
  };
  return { db: { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});

import { deleteInquiryAction } from "@/lib/actions/inquiries";

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
