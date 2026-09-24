import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("@/lib/actions/tasks", () => ({ toggleTaskAction: vi.fn() }));
vi.mock("@/lib/actions/brief", () => ({ setEventTypeAction: vi.fn() }));

import { AgentPanel } from "@/components/agent-panel";
import type { Briefing } from "@/lib/agent/briefing";

const briefing: Briefing = {
  eventId: "e1",
  items: [
    {
      id: "task_due:t1",
      kind: "task_due",
      urgency: "now",
      title: "Lock the date, the headcount and the budget",
      detail: "Everything downstream keys off these three numbers.",
      action: { type: "complete_task", taskId: "t1", label: "Mark done" },
    },
    {
      id: "venue_missing:e1",
      kind: "venue_missing",
      urgency: "soon",
      title: "Book the venue",
      detail: "Nothing booked for the space.",
      action: { type: "open_plan", label: "Open the plan" },
    },
  ],
  counts: { now: 1, soon: 1, total: 2 },
  headline: "1 thing needs you today",
};

const render = (b: Briefing, firstName: string | null = "Leo") =>
  renderToStaticMarkup(
    createElement(AgentPanel, { briefing: b, eventId: "e1", canSend: true, venueSearchEnabled: true, firstName }),
  );

describe("AgentPanel", () => {
  it("speaks as Hosty and greets the host by name", () => {
    const html = render(briefing);
    expect(html).toContain(">Hosty<");
    expect(html).toContain("1 thing needs you today");
    expect(html).toContain("Hi Leo, one thing needs you today and one is coming up:");
  });

  it("lists every item with its one action", () => {
    const html = render(briefing);
    expect(html).toContain("Lock the date, the headcount and the budget");
    expect(html).toContain("Mark done");
    expect(html).toContain('name="taskId" value="t1"');
    expect(html).toContain("Book the venue");
    expect(html).toContain('href="/events/e1/plan"');
    expect(html.match(/<li /g)?.length).toBe(2);
  });

  it("shows each item's detail once, as a visible line under its title", () => {
    const html = render(briefing);
    const detail = "Everything downstream keys off these three numbers.";
    expect(html).toMatch(
      /Lock the date, the headcount and the budget<\/p><p class="[^"]*">Everything downstream keys off these three numbers\.<\/p>/,
    );
    expect(html.split(detail).length - 1).toBe(1);
    expect(html).toContain("Nothing booked for the space.");
    expect(html).not.toContain("title=");
    expect(html).not.toContain("sr-only");
  });

  it("marks what needs the host today apart from what's coming up", () => {
    const html = render(briefing);
    expect(html).toContain("Needs you today");
    expect(html).toContain("Coming up");
  });

  it("says all quiet, with no list, when there's nothing", () => {
    const html = render({ eventId: "e1", items: [], counts: { now: 0, soon: 0, total: 0 }, headline: "" });
    expect(html).toContain("All quiet. Nothing needs you today.");
    expect(html).not.toContain("<ul");
  });

  it("greets without a name when there isn't one", () => {
    expect(render(briefing, null)).toContain("Hi, one thing needs you today");
  });
});
