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
  const text = (markup: string) => markup.replace(/<[^>]+>/g, "");
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);

  /** The markup of the paragraph whose text starts with `start`. */
  const paragraph = (start: string) => {
    const found = paragraphs.filter((p) => text(p).startsWith(start));
    expect(found).toHaveLength(1);
    return found[0];
  };

  const subtitles = [
    "Brief it once and it drafts the plan, writes to the venues, chases the quotes, tracks who’s coming, and hands you a run sheet for the day. You approve. It does the rest.",
    "Not a chatbot bolted onto a form. It carries one event from the first idea to the last person through the door.",
    "The agent drafts the plan",
    "Nothing is sent, published or spent without you pressing the button. Every message is yours to edit first.",
    "You’ll have a plan before you close the tab.",
    "Claude and ChatGPT can read your events and briefs and search venues. Cursor can read your events and guest lists.",
  ];

  it("waves the line under every heading, like the headings", () => {
    for (const subtitle of subtitles) expect(paragraph(subtitle)).toContain('class="wave-line');
  });

  it("holds each subtitle's text once, so copy and find-in-page see it once", () => {
    const page = text(html);
    for (const subtitle of subtitles) {
      const markup = paragraph(subtitle);
      expect(text(markup)).toBe(subtitle);
      expect(markup).not.toContain("sr-only");
      expect(markup).not.toContain("aria-hidden");
      expect(page.split(subtitle)).toHaveLength(2);
    }
  });

  it("leaves the stage descriptions still, so the page doesn't feel busy", () => {
    expect(paragraph("Tell it what you").includes("wave-line")).toBe(false);
  });
});

describe("WaveText timing", () => {
  const step = (text: string, by?: "letter" | "word") => {
    const html = renderToStaticMarkup(createElement(WaveText, { text, by }));
    const m = html.match(/--wave-step:(\d+)ms/);
    return {
      ms: m ? Number(m[1]) : 28,
      letters: text.replace(/ /g, "").length,
      words: text.split(" ").length,
    };
  };
  const long = "Brief it once and it drafts the plan, writes to the venues, chases the quotes, tracks who’s coming, and hands you a run sheet for the day.";

  it("keeps the 28ms letter stagger for headline-length text", () => {
    expect(step("Connect an agent").ms).toBe(28);
  });

  it("tightens the stagger for long lines, so the whole wave lands within about a second", () => {
    const { ms, letters } = step(long);
    expect(ms).toBeLessThan(28);
    expect(ms * letters).toBeLessThanOrEqual(1100);
  });

  it("staggers words by 45ms on short subtitles", () => {
    expect(step("The agent drafts the plan", "word").ms).toBe(45);
  });

  it("tightens the word stagger for long subtitles, so the wave still lands within about a second", () => {
    const { ms, words } = step(long, "word");
    expect(ms).toBeLessThan(45);
    expect(ms * words).toBeLessThanOrEqual(1000);
  });
});
