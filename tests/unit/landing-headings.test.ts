import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    createElement("img", { src, alt, className }),
}));
vi.mock("@/lib/actions/events", () => ({ createBlankEventAction: vi.fn() }));

import { Landing } from "@/components/landing";
import { WaveText } from "@/components/wave-text";

/** Every h1–h3 on the page, as markup. */
function headings(html: string): string[] {
  return [...html.matchAll(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2]);
}

describe("landing headings", () => {
  const html = renderToStaticMarkup(createElement(Landing, { canCreate: false }));
  const all = headings(html);

  it("finds the page's headings", () => {
    // The hero, the stages section and its four stages, Connect an agent,
    // the three reasons, and the closing call to action.
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it("waves every heading's letters on hover, never scrambles them", () => {
    for (const heading of all) expect(heading).toContain('class="wave-line');
  });

  it("keeps every heading readable to screen readers", () => {
    for (const heading of all) expect(heading).toMatch(/<span class="sr-only">[^<]+<\/span>/);
    expect(html).toContain('<span class="sr-only">The agent works every stage</span>');
    expect(html).toContain('<span class="sr-only">Connect an agent</span>');
    expect(html).toContain('<span class="sr-only">Give it a date and a headcount</span>');
  });
});

describe("landing subtitles", () => {
  const html = renderToStaticMarkup(createElement(Landing, { canCreate: false }));

  /** The markup of the paragraph whose screen-reader text starts with `start`. */
  const paragraph = (start: string) => {
    const at = html.indexOf(start);
    expect(at).toBeGreaterThan(-1);
    return html.slice(html.lastIndexOf("<p", at), html.indexOf("</p>", at));
  };

  it("waves the line under every heading, like the headings", () => {
    for (const start of [
      "Brief it once and it drafts the plan",
      "Not a chatbot bolted onto a form",
      "The agent drafts the plan",
      "Nothing is sent, published or spent",
      "You’ll have a plan before you close the tab.",
      "Claude and ChatGPT can read your events",
    ]) {
      expect(paragraph(start)).toContain('class="wave-line');
    }
  });

  it("leaves the stage descriptions still, so the page doesn't feel busy", () => {
    expect(paragraph("Tell it what you").includes("wave-line")).toBe(false);
  });
});

describe("WaveText timing", () => {
  const step = (text: string) => {
    const html = renderToStaticMarkup(createElement(WaveText, { text }));
    const m = html.match(/--wave-step:(\d+)ms/);
    return { ms: m ? Number(m[1]) : 28, letters: text.replace(/ /g, "").length };
  };

  it("keeps the 28ms letter stagger for headline-length text", () => {
    expect(step("Connect an agent").ms).toBe(28);
  });

  it("tightens the stagger for long lines, so the whole wave lands within about a second", () => {
    const long = "Brief it once and it drafts the plan, writes to the venues, chases the quotes, tracks who’s coming, and hands you a run sheet for the day.";
    const { ms, letters } = step(long);
    expect(ms).toBeLessThan(28);
    expect(ms * letters).toBeLessThanOrEqual(1100);
  });
});
