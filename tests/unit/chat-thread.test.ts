import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

import { ChatThread } from "@/components/chat-thread";
import { ActivityFeed } from "@/components/activity-feed";
import type { ChatMessage } from "@/lib/hosty-voice";
import type { FeedRow } from "@/lib/activity-format";

const NOW = new Date("2026-09-23T20:00:00.000Z");
const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: "m",
  speaker: "hosty",
  text: "",
  createdAt: "2026-09-23T19:58:00.000Z",
  ...over,
});
const render = (messages: ChatMessage[], running = false) =>
  renderToStaticMarkup(createElement(ChatThread, { messages, running, now: NOW, eventId: "e1" }));

describe("ChatThread", () => {
  it("keeps the order it's given, oldest first", () => {
    const html = render([msg({ id: "1", text: "First" }), msg({ id: "2", text: "Second" })]);
    expect(html.indexOf("First")).toBeLessThan(html.indexOf("Second"));
  });

  it("puts one Hosty header over consecutive Hosty messages", () => {
    const html = render([msg({ id: "1", text: "One" }), msg({ id: "2", text: "Two" })]);
    expect(html.match(/data-speaker="hosty"/g)?.length).toBe(1);
    expect(html.match(/>Hosty</g)?.length).toBe(1);
    expect(html).toContain("One");
    expect(html).toContain("Two");
  });

  it("starts a new Hosty group after a note", () => {
    const html = render([
      msg({ id: "1", text: "Before" }),
      msg({ id: "2", speaker: "note", text: "Event created" }),
      msg({ id: "3", text: "After" }),
    ]);
    expect(html.match(/data-speaker="hosty"/g)?.length).toBe(2);
    expect(html.indexOf("Before")).toBeLessThan(html.indexOf("Event created"));
    expect(html.indexOf("Event created")).toBeLessThan(html.indexOf("After"));
  });

  it("shows the host's own lines as theirs and system lines as notes", () => {
    const html = render([
      msg({ id: "1", speaker: "you", text: "Updated the brief" }),
      msg({ id: "2", speaker: "note", text: "Event created" }),
    ]);
    expect(html).toContain('data-speaker="you"');
    expect(html).toContain('data-speaker="note"');
    expect(html).toContain("You: </span>Updated the brief");
  });

  it("prefixes every bubble with its speaker for screen readers", () => {
    const html = render([msg({ id: "1", text: "Hello" })]);
    expect(html).toContain('<span class="sr-only">Hosty: </span>Hello');
  });

  it("renders a message's action as a link inside the bubble", () => {
    const html = render([msg({ id: "1", text: "Plan", action: { label: "Open the plan", href: "/events/e1/plan" } })]);
    expect(html).toContain('href="/events/e1/plan"');
    expect(html).toContain("Open the plan");
  });

  it("shows the typing indicator only while Hosty is running", () => {
    expect(render([msg({ id: "1", text: "x" })], true)).toContain("Hosty is typing");
    expect(render([msg({ id: "1", text: "x" })], false)).not.toContain("Hosty is typing");
  });

  it("invites the host to fill in the brief when there's nothing yet", () => {
    const html = render([]);
    expect(html).toContain("Fill in the brief and I");
    expect(html).toContain('href="/events/e1/brief"');
  });

  it("shows typing instead of the invitation when Hosty is already running on an empty thread", () => {
    const html = render([], true);
    expect(html).toContain("Hosty is typing");
    expect(html).not.toContain("Fill in the brief");
  });
});

describe("ActivityFeed", () => {
  const row = (over: Partial<FeedRow>): FeedRow => ({
    id: "r",
    actor: "agent",
    kind: "run_started",
    title: "The agent is working on this",
    body: null,
    href: null,
    createdAt: "2026-09-23T19:58:00.000Z",
    ...over,
  });

  it("renders the newest-first feed as an oldest-first chat in Hosty's voice", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityFeed, {
        eventId: "e1",
        initial: [
          row({ id: "2", kind: "plan_drafted", title: "Plan drafted", body: "13 tasks · 4 budget categories", createdAt: "2026-09-23T19:59:00.000Z" }),
          row({ id: "1", createdAt: "2026-09-23T19:58:00.000Z" }),
        ],
        agent: { status: "running", lastRunAt: null, startedAt: null, needs: [] },
        now: NOW.toISOString(),
      }),
    );
    expect(html).toContain("What&#x27;s happening");
    expect(html.indexOf("On it. Let me take a look.")).toBeLessThan(
      html.indexOf("I drafted your plan: 13 tasks and 4 budget categories."),
    );
    expect(html).toContain("Hosty is typing");
  });
});
