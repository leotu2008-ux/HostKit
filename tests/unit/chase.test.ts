import { describe, expect, it } from "vitest";
import { CHASE_AFTER_DAYS, goneQuiet, quietContacts } from "@/lib/chase";
import type { CollaboratorStatus, InquiryStatus } from "@/generated/prisma/enums";

const NOW = new Date("2026-03-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function inquiry(over: {
  status: InquiryStatus;
  sentAt?: Date | null;
  respondedAt?: Date | null;
}) {
  return { sentAt: null, respondedAt: null, ...over };
}

describe("which inquiries have gone quiet", () => {
  it("counts one sent longer ago than the threshold", () => {
    const rows = [inquiry({ status: "SENT", sentAt: daysAgo(CHASE_AFTER_DAYS + 1) })];

    expect(goneQuiet(rows, NOW)).toHaveLength(1);
  });

  // The threshold is the point at which chasing becomes reasonable, so it
  // counts — a vendor silent for exactly this long is the case this exists for.
  it("counts one sent exactly at the threshold", () => {
    const rows = [inquiry({ status: "SENT", sentAt: daysAgo(CHASE_AFTER_DAYS) })];

    expect(goneQuiet(rows, NOW)).toHaveLength(1);
  });

  it("leaves a recent one alone", () => {
    const rows = [inquiry({ status: "SENT", sentAt: daysAgo(CHASE_AFTER_DAYS - 1) })];

    expect(goneQuiet(rows, NOW)).toEqual([]);
  });

  it("never chases someone who already answered", () => {
    const rows = [
      inquiry({ status: "REPLIED", sentAt: daysAgo(30), respondedAt: daysAgo(28) }),
      inquiry({ status: "QUOTED", sentAt: daysAgo(30) }),
      inquiry({ status: "BOOKED", sentAt: daysAgo(30) }),
      inquiry({ status: "DECLINED", sentAt: daysAgo(30) }),
    ];

    expect(goneQuiet(rows, NOW)).toEqual([]);
  });

  it("ignores a draft, however old — nothing was ever sent", () => {
    const rows = [inquiry({ status: "DRAFT", sentAt: null })];

    expect(goneQuiet(rows, NOW)).toEqual([]);
  });

  // Defensive: SENT with no sentAt should not be treated as infinitely old.
  it("ignores a sent row with no timestamp rather than chasing it forever", () => {
    const rows = [inquiry({ status: "SENT", sentAt: null })];

    expect(goneQuiet(rows, NOW)).toEqual([]);
  });
});

function contact(over: {
  status: CollaboratorStatus;
  sentAt?: Date | null;
  respondedAt?: Date | null;
}) {
  return { sentAt: null, respondedAt: null, ...over };
}

describe("which collaborators (venue/speaker/cohost) have gone quiet", () => {
  it("counts a PENDING contact asked longer ago than the threshold", () => {
    const rows = [contact({ status: "PENDING", sentAt: daysAgo(CHASE_AFTER_DAYS + 1) })];

    expect(quietContacts(rows, NOW)).toHaveLength(1);
  });

  // Same boundary rule as goneQuiet: exactly the threshold already counts.
  it("counts a PENDING contact asked exactly at the threshold", () => {
    const rows = [contact({ status: "PENDING", sentAt: daysAgo(CHASE_AFTER_DAYS) })];

    expect(quietContacts(rows, NOW)).toHaveLength(1);
  });

  it("never chases a contact who has already settled", () => {
    const rows = [
      contact({ status: "CONFIRMED", sentAt: daysAgo(30) }),
      contact({ status: "DECLINED", sentAt: daysAgo(30) }),
    ];

    expect(quietContacts(rows, NOW)).toEqual([]);
  });

  it("ignores a contact who was never sent anything", () => {
    const rows = [contact({ status: "PENDING", sentAt: null })];

    expect(quietContacts(rows, NOW)).toEqual([]);
  });

  it("ignores a contact who already responded", () => {
    const rows = [
      contact({ status: "PENDING", sentAt: daysAgo(30), respondedAt: daysAgo(28) }),
    ];

    expect(quietContacts(rows, NOW)).toEqual([]);
  });
});
