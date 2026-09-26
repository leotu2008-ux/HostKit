import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
  }) => createElement("a", { href, className }, children),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => createElement("img", { src, alt, className }),
}));

vi.mock("@/lib/actions/events", () => ({ createBlankEventAction: vi.fn() }));

import { Landing } from "@/components/landing";
import { LandingPreview } from "@/components/landing-preview";
import { Reveal } from "@/components/reveal";

/** The markup from each element whose class list starts with `className`,
 *  in document order, up to the next such element. */
function blocks(html: string, className: string): string[] {
  const starts = [...html.matchAll(new RegExp(`<[a-z0-9]+ [^>]*class="${className}[ "]`, "g"))]
    .map((match) => match.index);
  return starts.map((start, i) => html.slice(start, starts[i + 1]));
}

describe("landing preview card", () => {
  it("renders the whole example on the server, so it reads without JavaScript", () => {
    const html = renderToStaticMarkup(createElement(LandingPreview));

    expect(html).toContain("You brief it");
    expect(html).toContain(">Hosty<");
    expect(html).toContain("Here’s your plan for Thursday’s mixer:");
    expect(html).toContain("Mixer");
    expect(html).toContain("Thu 12 March, 8pm");
    expect(html).toContain("Lock the date, headcount and budget");
    expect(html).toContain("Confirm final headcount with the caterer");
    expect(html).toContain("Catering");
    expect(html).toContain("$1,500");
    // Nothing starts hidden: the play state is only ever entered client-side.
    expect(html).not.toContain('data-play="playing"');
    expect(html).not.toContain("is typing");
  });
});

describe("scroll reveal", () => {
  it("renders children visible on the server, with no pending state", () => {
    const html = renderToStaticMarkup(
      createElement(Reveal, { as: "section", className: "py-4" }, "Hello"),
    );
    expect(html).toContain("<section");
    expect(html).toContain("Hello");
    expect(html).toContain("reveal");
    expect(html).not.toContain("data-reveal");
  });
});

describe("landing page", () => {
  const html = renderToStaticMarkup(createElement(Landing, { canCreate: false }));

  it("queues the hero lines to rise in order, pill first and the preview last", () => {
    const lines = blocks(html, "rise");

    expect(lines.map((line) => line.match(/style="--i:(\d+)"/)?.[1])).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(lines[0]).toContain("Meet Hosty, an agent that saves you hours on every event");
    expect(lines[0]).toContain('viewBox="0 0 100 100"');
    expect(lines[1]).toContain("Plan the event.");
    expect(lines[1]).toContain("Let the agent do");
    expect(lines[1]).toContain("the work.");
    // Hosty pops out of "work": the mark, filled so the sky doesn't show through him.
    expect(lines[1]).toContain("hosty-pop");
    expect(lines[1]).toContain('viewBox="0 0 100 100"');
    expect(lines[1]).toContain('fill="#fff"');
    // The subtitle waves word by word, so read its text rather than its markup.
    expect(lines[2].replace(/<[^>]+>/g, "")).toContain("Brief it once and it drafts the plan");
    expect(lines[3]).toContain("Join the waitlist");
    expect(lines[3]).toContain('href="/signup"');
    // Hosty is B2B: no consumer "what's on" anywhere on the page.
    expect(lines[3]).not.toContain("See what’s on");
    expect(html).not.toContain('href="/discover"');
    expect(lines[4]).toContain("Invite-only while we’re small.");
    expect(html).not.toContain("Free to start");
    expect(html).not.toContain("No account needed");
    expect(lines[5]).toContain("You brief it");
  });

  it("reveals each stage, the Connect section, each principle and the call to action on scroll", () => {
    const revealed = blocks(html, "reveal");
    const openings = [
      "Brief it",
      "Source it",
      "Fill it",
      "Run it",
      "Connect an agent",
      "It knows yours isn",
      "It drafts, you decide",
      "It shows its work",
      "Give it a date and a headcount",
    ];

    expect(revealed).toHaveLength(openings.length);
    openings.forEach((text, i) => expect(revealed[i]).toContain(text));
    // Every block is visible as served; only the client marks one pending.
    expect(html).not.toContain("data-reveal");
    expect(html).not.toContain('data-play="playing"');
  });

  it("offers a signed-in host with access the Plan an event button instead", () => {
    const hostHtml = renderToStaticMarkup(createElement(Landing, { canCreate: true }));
    expect(hostHtml).toContain("Plan an event");
    expect(hostHtml).not.toContain("Invite-only");
  });
});
