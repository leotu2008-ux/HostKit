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
