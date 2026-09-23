import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/events/e1" }));
vi.mock("@/lib/actions/events", () => ({ createBlankEventAction: vi.fn() }));

import { AgentStatusLine } from "@/components/workspace-sidebar";
import type { AgentStatusView } from "@/lib/activity";

const NOW = "2026-09-23T20:00:00.000Z";
const render = (over: Partial<AgentStatusView>) =>
  renderToStaticMarkup(
    createElement(AgentStatusLine, {
      eventId: "e1",
      now: NOW,
      agent: { status: "done", lastRunAt: null, startedAt: null, needs: [], ...over },
    }),
  );

describe("AgentStatusLine", () => {
  it("shows Hosty working, with the mark pulsing", () => {
    const html = render({ status: "running" });
    expect(html).toContain("Hosty is working on this…");
    expect(html).toContain("animate-pulse");
    expect(html).toContain('viewBox="0 0 100 100"');
  });

  it("shows a queued run as about to start", () => {
    expect(render({ status: "queued" })).toContain("Hosty will start soon");
  });

  it("says what Hosty needs from the brief, linking to it", () => {
    const html = render({ status: "idle", needs: ["date", "city"] });
    expect(html).toContain("Hosty needs");
    expect(html).toContain('href="/events/e1/brief"');
  });

  it("offers a retry when the last run failed", () => {
    const html = render({ status: "failed" });
    expect(html).toContain("Hosty’s last run didn’t finish");
    expect(html).toContain("Try again");
  });

  it("rests with the time of the last run and offers another", () => {
    const html = render({ status: "done", lastRunAt: "2026-09-23T19:59:00.000Z" });
    expect(html).toContain("Hosty is resting · ran 1m ago");
    expect(html).toContain("Run again");
  });
});
