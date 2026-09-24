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
import { NYC_BOROUGHS } from "@/components/nyc-boroughs";

const BOROUGH_LABELS = ["THE BRONX", "MANHATTAN", "QUEENS", "BROOKLYN", "STATEN ISLAND"];
const WATER_LABELS = ["HUDSON RIVER", "EAST RIVER", "NEW YORK HARBOR", "ATLANTIC OCEAN"];
const STEPS = [
  "Start with New York",
  "Set your search point",
  "Explore nearby spaces",
  "Find your kind of place",
];

describe("venue discovery on the landing", () => {
  const html = renderToStaticMarkup(createElement(Landing, { canCreate: false }));
  const text = html.replace(/<[^>]+>/g, "");

  it("sits between the stages and Connect an agent", () => {
    const stages = html.indexOf("The agent works every stage");
    const map = html.indexOf('id="venue-discovery"');
    const connect = html.indexOf("Connect an agent");
    expect(stages).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(stages);
    expect(connect).toBeGreaterThan(map);
  });

  it("draws the five boroughs, the brief, and the four steps", () => {
    expect(NYC_BOROUGHS.map((borough) => borough.name).sort()).toEqual([
      "Bronx",
      "Brooklyn",
      "Manhattan",
      "Queens",
      "Staten Island",
    ]);
    for (const borough of NYC_BOROUGHS) {
      expect(borough.path.startsWith("M")).toBe(true);
      expect(html).toContain(`data-borough="${borough.name}"`);
    }

    expect(text).toContain("A place for your people");
    expect(text).toContain("Your next event starts nearby.");
    expect(text).toContain(
      "An area, a headcount, a feel. Give your agent a starting point, then explore spaces that could fit your brief.",
    );
    expect(text).toContain("NEW YORK CITY · ALL FIVE BOROUGHS");
    expect(text).toContain("THE BRIEF");
    expect(text).toContain("40 people. Room to mingle.");
    expect(text).toContain("EXAMPLE SHORTLIST");
    expect(text).toContain("3 spaces to explore");
    expect(text).toContain("NYC geography · Illustrative venues · No live location tracking");
    expect(text).toContain("Scroll to explore");
    expect(text).toContain("Skip the map");
    expect(html).toContain('href="#venue-discovery-end"');
    expect(html).toContain('id="venue-discovery-end"');
    expect(html).toContain('transform="translate(285.1 278.2)"');

    for (const label of [...BOROUGH_LABELS, ...WATER_LABELS]) {
      expect(html).toContain(label);
    }
    STEPS.forEach((step, index) => {
      expect(text).toContain(step);
      expect(html).toContain(`data-step="${index}"`);
    });
    for (let i = 0; i < 5; i++) expect(html).toContain(`data-venue="${i}"`);

    expect(html).toContain("five fictional venue markers");
    expect(html).not.toContain("data-motion=");
  });
});
