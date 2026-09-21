import { describe, expect, it } from "vitest";
import {
  DUE_SOON_DAYS,
  MAX_ITEMS,
  briefingFor,
  digestNotice,
  numbersAreGrounded,
  worthNotifying,
  type BriefingCollaborator,
  type BriefingInquiry,
  type BriefingTask,
} from "@/lib/agent/briefing";
import { CHASE_AFTER_DAYS } from "@/lib/chase";

const NOW = new Date("2026-01-15T09:30:00");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const EVENT = { id: "e1", title: "Fall Mixer", date: inDays(10) };

function task(over: Partial<BriefingTask> & { id: string }): BriefingTask {
  return { title: "Task", dueDate: null, status: "TODO", category: null, ...over };
}

function inquiry(over: Partial<BriefingInquiry> & { id: string }): BriefingInquiry {
  return {
    name: "Vendor",
    status: "DRAFT",
    toEmail: null,
    sentAt: null,
    respondedAt: null,
    category: null,
    ...over,
  };
}

function collaborator(over: Partial<BriefingCollaborator> & { id: string }): BriefingCollaborator {
  return { kind: "VENUE", name: "Collaborator", email: null, status: "PENDING", sentAt: null, ...over };
}

// A venue collaborator that is settled enough not to trip venue_missing, so
// scenarios that don't care about venues can stay otherwise empty.
const SETTLED_VENUE = collaborator({ id: "venue-settled", kind: "VENUE", status: "CONFIRMED" });

describe("briefingFor — tasks", () => {
  it("a task due today is now", () => {
    const b = briefingFor(EVENT, {
      tasks: [task({ id: "t1", title: "RSVP the caterer", dueDate: NOW })],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    const item = b.items.find((i) => i.id === "task_due:t1");
    expect(item).toMatchObject({ kind: "task_due", urgency: "now" });
  });

  it("a task due within DUE_SOON_DAYS is soon, and one day past the window is absent", () => {
    const soon = briefingFor(EVENT, {
      tasks: [task({ id: "t1", dueDate: inDays(DUE_SOON_DAYS) })],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(soon.items.find((i) => i.id === "task_due:t1")).toMatchObject({
      kind: "task_due",
      urgency: "soon",
    });

    const absent = briefingFor(EVENT, {
      tasks: [task({ id: "t1", dueDate: inDays(DUE_SOON_DAYS + 1) })],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(absent.items.find((i) => i.id === "task_due:t1")).toBeUndefined();
  });

  it("an overdue task names how many days it has been overdue", () => {
    const b = briefingFor(EVENT, {
      tasks: [task({ id: "t1", title: "Confirm headcount", dueDate: daysAgo(3) })],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    const item = b.items.find((i) => i.id === "task_overdue:t1");
    expect(item).toMatchObject({ kind: "task_overdue", urgency: "now" });
    expect(item!.detail).toContain("3");
  });

  it("never surfaces a DONE task or one with no due date", () => {
    const b = briefingFor(EVENT, {
      tasks: [
        task({ id: "t1", status: "DONE", dueDate: NOW }),
        task({ id: "t2", status: "TODO", dueDate: null }),
      ],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(b.items.find((i) => i.id.endsWith(":t1"))).toBeUndefined();
    expect(b.items.find((i) => i.id.endsWith(":t2"))).toBeUndefined();
  });

  it("every complete_task action carries a taskId that is actually in the input", () => {
    const b = briefingFor(EVENT, {
      tasks: [task({ id: "t1", dueDate: NOW })],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    const item = b.items.find((i) => i.id === "task_due:t1")!;
    expect(item.action).toEqual({ type: "complete_task", taskId: "t1", label: "Mark done" });
  });
});

describe("briefingFor — every emitted action.type is a known kind", () => {
  it("exhaustively switches over every item's action, and a complete_task's taskId is in the input", () => {
    const inputTasks = [task({ id: "t1", dueDate: NOW })];
    const soonEvent = { id: "e1", title: "Fall Mixer", date: inDays(2) };
    const b = briefingFor(soonEvent, {
      tasks: inputTasks,
      inquiries: [
        inquiry({ id: "i1", status: "SENT", sentAt: daysAgo(CHASE_AFTER_DAYS) }),
        inquiry({ id: "i2", status: "DRAFT", toEmail: "vendor@example.com" }),
      ],
      collaborators: [],
      now: NOW,
    });

    // A rich-enough scenario to actually exercise every kind this function
    // can emit: task_due (from t1), outreach_quiet (i1), outreach_unsent
    // (i2), venue_missing (no VENUE collaborator or booked inquiry), and
    // event_soon (soonEvent is within EVENT_SOON_DAYS).
    const seenKinds = new Set(b.items.map((i) => i.kind));
    expect(seenKinds).toEqual(
      new Set(["task_due", "outreach_quiet", "outreach_unsent", "venue_missing", "event_soon"]),
    );

    for (const item of b.items) {
      const action = item.action;
      switch (action.type) {
        case "complete_task": {
          const taskId = action.taskId; // narrowed here, not inside the closure below
          expect(inputTasks.some((t) => t.id === taskId)).toBe(true);
          break;
        }
        case "open_outreach":
        case "find_venues":
        case "open_runsheet":
        case "open_plan":
          break;
        default: {
          // Exhaustive: adding a BriefingAction variant without a case here
          // fails to compile, not just fails at runtime.
          const _exhaustive: never = action;
          throw new Error(`Unknown action type: ${JSON.stringify(_exhaustive)}`);
        }
      }
    }
  });
});

describe("briefingFor — outreach (catalog inquiries)", () => {
  it("an inquiry silent for exactly CHASE_AFTER_DAYS has gone quiet", () => {
    const b = briefingFor(EVENT, {
      tasks: [],
      inquiries: [inquiry({ id: "i1", status: "SENT", sentAt: daysAgo(CHASE_AFTER_DAYS) })],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(b.items.find((i) => i.id === "outreach_quiet:i1")).toMatchObject({ kind: "outreach_quiet" });
  });

  it("gets more urgent once it has been silent twice as long", () => {
    const stillSoon = briefingFor(EVENT, {
      tasks: [],
      inquiries: [inquiry({ id: "i1", status: "SENT", sentAt: daysAgo(CHASE_AFTER_DAYS) })],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(stillSoon.items.find((i) => i.id === "outreach_quiet:i1")).toMatchObject({ urgency: "soon" });

    const nowUrgent = briefingFor(EVENT, {
      tasks: [],
      inquiries: [inquiry({ id: "i1", status: "SENT", sentAt: daysAgo(2 * CHASE_AFTER_DAYS) })],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(nowUrgent.items.find((i) => i.id === "outreach_quiet:i1")).toMatchObject({ urgency: "now" });
  });

  it("a vendor who replied never shows up", () => {
    const b = briefingFor(EVENT, {
      tasks: [],
      inquiries: [
        inquiry({ id: "i1", status: "REPLIED", sentAt: daysAgo(30), respondedAt: daysAgo(28) }),
      ],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(b.items).toHaveLength(0);
  });

  it("a drafted inquiry with an address on a dated event is unsent; without an address it is not", () => {
    const withAddress = briefingFor(EVENT, {
      tasks: [],
      inquiries: [inquiry({ id: "i1", status: "DRAFT", toEmail: "venue@example.com" })],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(withAddress.items.find((i) => i.id === "outreach_unsent:i1")).toMatchObject({
      kind: "outreach_unsent",
    });

    const withoutAddress = briefingFor(EVENT, {
      tasks: [],
      inquiries: [inquiry({ id: "i1", status: "DRAFT", toEmail: null })],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(withoutAddress.items.find((i) => i.id === "outreach_unsent:i1")).toBeUndefined();
  });
});

describe("briefingFor — outreach (collaborators)", () => {
  it("a PENDING collaborator with an email is unsent; CONFIRMED never shows up", () => {
    const pending = briefingFor(EVENT, {
      tasks: [],
      inquiries: [],
      collaborators: [
        SETTLED_VENUE,
        collaborator({ id: "c1", kind: "SPEAKER", email: "speaker@example.com", status: "PENDING" }),
      ],
      now: NOW,
    });
    expect(pending.items.find((i) => i.id === "outreach_unsent:c1")).toMatchObject({
      kind: "outreach_unsent",
    });

    const confirmed = briefingFor(EVENT, {
      tasks: [],
      inquiries: [],
      collaborators: [
        SETTLED_VENUE,
        collaborator({ id: "c1", kind: "SPEAKER", email: "speaker@example.com", status: "CONFIRMED" }),
      ],
      now: NOW,
    });
    expect(confirmed.items.find((i) => i.id === "outreach_unsent:c1")).toBeUndefined();
  });
});

describe("briefingFor — venue_missing", () => {
  it("shows up with no VENUE collaborator, and goes away once there is one", () => {
    const missing = briefingFor(EVENT, { tasks: [], inquiries: [], collaborators: [], now: NOW });
    expect(missing.items.find((i) => i.kind === "venue_missing")).toBeDefined();

    const covered = briefingFor(EVENT, {
      tasks: [],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(covered.items.find((i) => i.kind === "venue_missing")).toBeUndefined();
  });

  it("also counts as covered a BOOKED VENUE-category catalog inquiry, with no collaborator at all", () => {
    const b = briefingFor(EVENT, {
      tasks: [],
      inquiries: [inquiry({ id: "i1", status: "BOOKED", category: "VENUE" })],
      collaborators: [],
      now: NOW,
    });
    expect(b.items.find((i) => i.kind === "venue_missing")).toBeUndefined();
  });

  it("a BOOKED inquiry in a different category does not cover the venue", () => {
    const b = briefingFor(EVENT, {
      tasks: [],
      inquiries: [inquiry({ id: "i1", status: "BOOKED", category: "CATERING" })],
      collaborators: [],
      now: NOW,
    });
    expect(b.items.find((i) => i.kind === "venue_missing")).toBeDefined();
  });

  it("a VENUE-category inquiry that is only SENT, not BOOKED, does not cover the venue", () => {
    const b = briefingFor(EVENT, {
      tasks: [],
      inquiries: [inquiry({ id: "i1", status: "SENT", category: "VENUE", sentAt: daysAgo(1) })],
      collaborators: [],
      now: NOW,
    });
    expect(b.items.find((i) => i.kind === "venue_missing")).toBeDefined();
  });
});

describe("briefingFor — event_soon", () => {
  it("an event two days out is now", () => {
    const b = briefingFor(
      { id: "e1", title: "Fall Mixer", date: inDays(2) },
      { tasks: [], inquiries: [], collaborators: [SETTLED_VENUE], now: NOW },
    );
    expect(b.items.find((i) => i.kind === "event_soon")).toMatchObject({ urgency: "now" });
  });

  it("an event five days out is soon, and one nine days out is absent", () => {
    const soon = briefingFor(
      { id: "e1", title: "Fall Mixer", date: inDays(5) },
      { tasks: [], inquiries: [], collaborators: [SETTLED_VENUE], now: NOW },
    );
    expect(soon.items.find((i) => i.kind === "event_soon")).toMatchObject({ urgency: "soon" });

    const absent = briefingFor(
      { id: "e1", title: "Fall Mixer", date: inDays(9) },
      { tasks: [], inquiries: [], collaborators: [SETTLED_VENUE], now: NOW },
    );
    expect(absent.items.find((i) => i.kind === "event_soon")).toBeUndefined();
  });
});

describe("briefingFor — sorting and the cap", () => {
  it("caps at MAX_ITEMS and never drops a 'now' item to make room for a 'soon' one", () => {
    const overdueTasks = Array.from({ length: 5 }, (_, i) =>
      task({ id: `now-${i}`, title: `Overdue ${i}`, dueDate: daysAgo(i + 1) }),
    );
    const soonTasks = Array.from({ length: 7 }, (_, i) =>
      task({ id: `soon-${i}`, title: `Soon ${i}`, dueDate: inDays(1) }),
    );
    const b = briefingFor(EVENT, {
      tasks: [...overdueTasks, ...soonTasks],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(b.items).toHaveLength(MAX_ITEMS);
    for (const t of overdueTasks) {
      expect(b.items.find((i) => i.id === `task_overdue:${t.id}`), `missing ${t.id}`).toBeDefined();
    }
  });

  it("is deterministic — the same input produces the same order twice", () => {
    const input = {
      tasks: [
        task({ id: "t1", title: "B task", dueDate: daysAgo(1) }),
        task({ id: "t2", title: "A task", dueDate: daysAgo(1) }),
      ],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    };
    const first = briefingFor(EVENT, input);
    const second = briefingFor(EVENT, input);
    expect(first.items.map((i) => i.id)).toEqual(second.items.map((i) => i.id));
  });
});

describe("briefingFor — the empty state", () => {
  it("reports nothing when everything is already settled", () => {
    const b = briefingFor(EVENT, {
      tasks: [],
      inquiries: [],
      collaborators: [SETTLED_VENUE],
      now: NOW,
    });
    expect(b.items).toEqual([]);
    expect(b.headline).toBe("");
    expect(worthNotifying(b)).toBe(false);
  });
});

describe("digestNotice", () => {
  it("carries the first three titles, a '+N more', and no invented number", () => {
    const letters = ["A", "B", "C", "D", "E"];
    const tasks = letters.map((letter, i) => task({ id: `t${i}`, title: `Task ${letter}`, dueDate: daysAgo(1) }));
    const b = briefingFor(EVENT, { tasks, inquiries: [], collaborators: [SETTLED_VENUE], now: NOW });
    const notice = digestNotice(b, EVENT.title);

    const firstThree = b.items.slice(0, 3).map((i) => i.title);
    for (const title of firstThree) expect(notice.body).toContain(title);

    const remaining = b.items.length - 3;
    expect(numbersAreGrounded(notice.body, [remaining])).toBe(true);
  });
});

describe("numbersAreGrounded", () => {
  it("passes a number that was given", () => {
    expect(numbersAreGrounded("3 things", [3])).toBe(true);
  });

  it("fails a number that was not given", () => {
    expect(numbersAreGrounded("12 vendors", [3])).toBe(false);
  });

  it("passes text with no digits at all", () => {
    expect(numbersAreGrounded("nothing urgent", [3])).toBe(true);
  });
});
