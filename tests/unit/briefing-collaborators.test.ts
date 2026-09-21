import { describe, expect, it } from "vitest";
import { briefingFor, type BriefingCollaborator } from "@/lib/agent/briefing";
import { CHASE_AFTER_DAYS } from "@/lib/chase";

/**
 * Milestone D wires real sentAt/respondedAt onto EventCollaborator, so
 * briefingFor's collaborator branch switches from an inline cutoff to
 * lib/chase.ts's quietContacts. tests/unit/briefing.test.ts already covers
 * the unsent/CONFIRMED cases pre-D; this file is the new "asked and gone
 * quiet" behaviour, kept separate per the plan's file boundaries.
 */

const NOW = new Date("2026-01-15T09:30:00");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const EVENT = { id: "e1", title: "Fall Mixer", date: null };

function collaborator(over: Partial<BriefingCollaborator> & { id: string }): BriefingCollaborator {
  return {
    kind: "VENUE",
    name: "The Loft",
    email: "loft@example.com",
    status: "PENDING",
    sentAt: null,
    respondedAt: null,
    ...over,
  };
}

describe("briefingFor — collaborator outreach after Milestone D", () => {
  it("a PENDING collaborator asked 6 days ago is outreach_quiet", () => {
    const b = briefingFor(EVENT, {
      tasks: [],
      inquiries: [],
      collaborators: [collaborator({ id: "c1", sentAt: daysAgo(CHASE_AFTER_DAYS + 1) })],
      now: NOW,
    });

    expect(b.items.find((i) => i.id === "outreach_quiet:c1")).toMatchObject({
      kind: "outreach_quiet",
    });
  });

  it("a PENDING collaborator with no sentAt is outreach_unsent, not quiet", () => {
    const b = briefingFor(EVENT, {
      tasks: [],
      inquiries: [],
      collaborators: [collaborator({ id: "c1", sentAt: null })],
      now: NOW,
    });

    expect(b.items.find((i) => i.id === "outreach_unsent:c1")).toMatchObject({
      kind: "outreach_unsent",
    });
    expect(b.items.find((i) => i.id === "outreach_quiet:c1")).toBeUndefined();
  });

  it("a CONFIRMED collaborator never shows up, however long ago it was asked", () => {
    const b = briefingFor(EVENT, {
      tasks: [],
      inquiries: [],
      collaborators: [
        collaborator({ id: "c1", status: "CONFIRMED", sentAt: daysAgo(CHASE_AFTER_DAYS + 30) }),
      ],
      now: NOW,
    });

    expect(b.items.find((i) => i.id === "outreach_quiet:c1")).toBeUndefined();
    expect(b.items.find((i) => i.id === "outreach_unsent:c1")).toBeUndefined();
  });
});
