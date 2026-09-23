import { describe, expect, it } from "vitest";
import type { FeedRow } from "@/lib/activity-format";
import { numbersAreGrounded, type Briefing, type BriefingItem } from "@/lib/agent/briefing";
import {
  briefingIntro,
  firstNameOf,
  naturalList,
  toChatMessage,
  toChatThread,
} from "@/lib/hosty-voice";

const row = (over: Partial<FeedRow>): FeedRow => ({
  id: "r1",
  actor: "agent",
  kind: "plan_drafted",
  title: "",
  body: null,
  href: null,
  createdAt: "2026-09-23T19:00:00.000Z",
  ...over,
});

const numbersIn = (text: string) => (text.match(/\d+/g) ?? []).map(Number);

describe("toChatMessage: Hosty's lines", () => {
  const cases: Array<[string, Partial<FeedRow>, string]> = [
    ["run started", { kind: "run_started", title: "The agent is working on this" }, "On it. Let me take a look."],
    [
      "plan from the template",
      { kind: "plan_drafted", title: "Plan drafted", body: "13 tasks · 4 budget categories · from the template" },
      "I drafted your plan: 13 tasks and 4 budget categories. I used the standard template for now.",
    ],
    [
      "plan written by the model",
      { kind: "plan_drafted", title: "Plan drafted", body: "9 tasks · 3 budget categories · written for this event" },
      "I drafted your plan: 9 tasks and 3 budget categories. I wrote it for this event.",
    ],
    [
      "plan saved before the source was recorded",
      { kind: "plan_drafted", title: "Plan drafted", body: "13 tasks · 4 budget categories" },
      "I drafted your plan: 13 tasks and 4 budget categories.",
    ],
    [
      "three venues",
      {
        kind: "venues_attached",
        title: "3 venues lined up",
        body: "Back Bay Events Center · Somerville Studios Event Space · Southie Event Spaces",
      },
      "I lined up 3 venues: Back Bay Events Center, Somerville Studios Event Space and Southie Event Spaces. Nothing's been sent.",
    ],
    [
      "one venue",
      { kind: "venues_attached", title: "1 venue lined up", body: "Back Bay Events Center" },
      "I lined up 1 venue: Back Bay Events Center. Nothing's been sent.",
    ],
    ["no venues", { kind: "venue_search_empty", title: "No venues turned up nearby" }, "I couldn't find venues nearby yet."],
    [
      "two inquiries",
      { kind: "inquiries_drafted", title: "2 vendor inquiries drafted", body: "Catering · AV & production" },
      "I drafted 2 vendor inquiries: catering and AV & production. They're waiting for you to send.",
    ],
    [
      "one inquiry",
      { kind: "inquiries_drafted", title: "1 vendor inquiry drafted", body: "Catering" },
      "I drafted 1 vendor inquiry: catering. It's waiting for you to send.",
    ],
    [
      "no vendors",
      { kind: "inquiries_drafted", title: "No vendors to draft for" },
      "I couldn't find vendors in the catalog that fit this date yet.",
    ],
    [
      "skipped with a reason",
      { kind: "step_skipped", title: "Didn't look for venues", body: "You already have a venue" },
      "I didn't look for venues. You already have a venue.",
    ],
    ["skipped without a reason", { kind: "step_skipped", title: "Skipped the plan" }, "I skipped the plan."],
    [
      "failed",
      { kind: "step_failed", title: "Couldn't find venues", body: "timeout" },
      "I couldn't find venues. I'll try again on the next run.",
    ],
    ["finished", { kind: "run_finished", title: "The agent finished" }, "All done for now."],
    [
      "finished with problems",
      { kind: "run_finished", title: "The agent finished with problems" },
      "Done, but a couple of things didn't work.",
    ],
    ["already running", { kind: "run_finished", title: "The agent is already on it" }, "I'm already on it."],
    [
      "rate limited",
      { kind: "run_finished", title: "Too many runs this hour — try again later" },
      "I've run a lot this hour. Try me again a bit later.",
    ],
    [
      "couldn't start",
      { kind: "run_finished", title: "The agent couldn't start" },
      "I couldn't get started. Try again in a moment.",
    ],
  ];

  it.each(cases)("%s", (_name, over, expected) => {
    const message = toChatMessage(row(over));
    expect(message.speaker).toBe("hosty");
    expect(message.text).toBe(expected);
  });

  it.each(cases)("%s never invents a number", (_name, over) => {
    const source = row(over);
    const message = toChatMessage(source);
    expect(numbersAreGrounded(message.text, numbersIn(`${source.title} ${source.body ?? ""}`))).toBe(true);
  });

  it("falls back to the saved title and body for a kind it doesn't know, still as Hosty", () => {
    const message = toChatMessage(row({ kind: "brand_new_step", title: "Did a new thing", body: "3 of them" }));
    expect(message).toMatchObject({ speaker: "hosty", text: "Did a new thing — 3 of them" });
  });

  it("falls back when a known kind's title doesn't match the expected shape", () => {
    const message = toChatMessage(row({ kind: "venues_attached", title: "Venues attached" }));
    expect(message.text).toBe("Venues attached");
  });
});

describe("toChatMessage: the host and the system", () => {
  it("turns a brief save into your own line", () => {
    const message = toChatMessage(
      row({ actor: "host", kind: "brief_saved", title: "Brief updated", body: "Title · Date · City" }),
    );
    expect(message).toMatchObject({ speaker: "you", text: "Updated the brief: title, date and city" });
  });

  it("reads a manual run as you asking Hosty", () => {
    const message = toChatMessage(
      row({ actor: "host", kind: "run_started", title: "You asked the agent to take another look" }),
    );
    expect(message).toMatchObject({ speaker: "you", text: "Asked Hosty to take another look" });
  });

  it("keeps other host lines as saved", () => {
    const message = toChatMessage(row({ actor: "host", kind: "task_done", title: "Done: Book the venue" }));
    expect(message).toMatchObject({ speaker: "you", text: "Done: Book the venue" });
  });

  it("shows system rows as a note with just the title", () => {
    const message = toChatMessage(
      row({
        actor: "system",
        kind: "event_created",
        title: "Event created",
        body: "Fill in the brief and the agent gets going.",
      }),
    );
    expect(message).toMatchObject({ speaker: "note", text: "Event created" });
  });
});

describe("toChatMessage: actions", () => {
  it("labels the link by kind", () => {
    expect(toChatMessage(row({ kind: "plan_drafted", title: "Plan drafted", href: "/events/e1/plan" })).action).toEqual({
      label: "Open the plan",
      href: "/events/e1/plan",
    });
    expect(
      toChatMessage(row({ kind: "venues_attached", title: "2 venues lined up", href: "/events/e1/venue" })).action,
    ).toEqual({ label: "See the venues", href: "/events/e1/venue" });
    expect(
      toChatMessage(row({ kind: "inquiries_drafted", title: "1 vendor inquiry drafted", href: "/events/e1/outreach" }))
        .action,
    ).toEqual({ label: "Review the drafts", href: "/events/e1/outreach" });
  });

  it("uses Open for any other linked row, and no action without a link", () => {
    expect(toChatMessage(row({ actor: "host", kind: "published", title: "Published", href: "/e/e1" })).action).toEqual({
      label: "Open",
      href: "/e/e1",
    });
    expect(toChatMessage(row({ kind: "run_started", title: "x" })).action).toBeUndefined();
  });
});

describe("toChatThread", () => {
  it("orders oldest first, breaking same-instant ties by id", () => {
    const rows = [
      row({ id: "b", createdAt: "2026-09-23T19:02:00.000Z", kind: "run_started", title: "x" }),
      row({ id: "c", createdAt: "2026-09-23T19:01:00.000Z", kind: "run_started", title: "x" }),
      row({ id: "a", createdAt: "2026-09-23T19:02:00.000Z", kind: "run_started", title: "x" }),
    ];
    expect(toChatThread(rows).map((m) => m.id)).toEqual(["c", "a", "b"]);
  });
});

describe("naturalList", () => {
  it("joins zero, one, two and three items the way a person would", () => {
    expect(naturalList([])).toBe("");
    expect(naturalList(["A"])).toBe("A");
    expect(naturalList(["A", "B"])).toBe("A and B");
    expect(naturalList(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("firstNameOf", () => {
  it("takes the first word of a trimmed name, or null when there isn't one", () => {
    expect(firstNameOf("  Leo Tu ")).toBe("Leo");
    expect(firstNameOf("Leo")).toBe("Leo");
    expect(firstNameOf("")).toBeNull();
    expect(firstNameOf("   ")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf(undefined)).toBeNull();
  });
});

describe("briefingIntro", () => {
  const item = (urgency: "now" | "soon", id: string): BriefingItem => ({
    id,
    kind: "task_due",
    urgency,
    title: id,
    detail: "",
    action: { type: "complete_task", taskId: id, label: "Mark done" },
  });
  const briefing = (now: number, soon: number): Briefing => ({
    eventId: "e1",
    items: [
      ...Array.from({ length: now }, (_, i) => item("now", `n${i}`)),
      ...Array.from({ length: soon }, (_, i) => item("soon", `s${i}`)),
    ],
    counts: { now, soon, total: now + soon },
    headline: "",
  });

  it("says all quiet when there's nothing", () => {
    expect(briefingIntro(briefing(0, 0), "Leo")).toBe("All quiet. Nothing needs you today.");
  });

  it("says nothing's urgent when everything is upcoming", () => {
    expect(briefingIntro(briefing(0, 1), "Leo")).toBe("Hi Leo, nothing's urgent. One thing is coming up:");
    expect(briefingIntro(briefing(0, 3), "Leo")).toBe("Hi Leo, nothing's urgent. 3 things are coming up:");
  });

  it("leads with what needs the host today", () => {
    expect(briefingIntro(briefing(1, 0), "Leo")).toBe("Hi Leo, one thing needs you today:");
    expect(briefingIntro(briefing(1, 1), "Leo")).toBe("Hi Leo, one thing needs you today and one is coming up:");
    expect(briefingIntro(briefing(1, 4), "Leo")).toBe("Hi Leo, one thing needs you today and 4 are coming up:");
    expect(briefingIntro(briefing(2, 0), "Leo")).toBe("Hi Leo, 2 things need you today:");
    expect(briefingIntro(briefing(2, 3), "Leo")).toBe("Hi Leo, 2 things need you today and 3 are coming up:");
  });

  it("drops the name when there isn't one", () => {
    expect(briefingIntro(briefing(1, 0), null)).toBe("Hi, one thing needs you today:");
  });
});
