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
import { NYC_LAND, NYC_SEARCH, NYC_VIEW } from "@/lib/nyc-borough-map";

function ring(d: string): [number, number][] {
  const nums = d
    .replace(/[MLZ]/g, " ")
    .trim()
    .split(/\s+/)
    .map(Number);
  const points: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
  return points;
}

function inside(x: number, y: number, points: [number, number][]): boolean {
  let hit = false;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) hit = !hit;
  }
  return hit;
}

describe("five borough map", () => {
  it("keeps the search point on Manhattan, inside the drawing", () => {
    const manhattan = NYC_LAND.find((land) => land.name === "Manhattan");
    expect(manhattan).toBeDefined();
    expect(NYC_SEARCH.x).toBeGreaterThan(0);
    expect(NYC_SEARCH.x).toBeLessThan(NYC_VIEW.width);
    expect(NYC_SEARCH.y).toBeGreaterThan(0);
    expect(NYC_SEARCH.y).toBeLessThan(NYC_VIEW.height);
    expect(inside(NYC_SEARCH.x, NYC_SEARCH.y, ring(manhattan!.d))).toBe(true);
    for (const land of NYC_LAND) {
      if (land.name === "Manhattan") continue;
      expect(inside(NYC_SEARCH.x, NYC_SEARCH.y, ring(land.d))).toBe(false);
    }
  });
});

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

  it("shows the five-borough locator, the brief, and the four steps", () => {
    expect(text).toContain("A place for your people");
    expect(text).toContain("Your next event starts nearby.");
    expect(text).toContain(
      "An area, a headcount, a feel. Give your agent a starting point, then explore spaces that could fit your brief.",
    );
    expect(text).toContain("New York City · All five boroughs");
    expect(text).toContain("The brief");
    expect(text).toContain("40 people. Room to mingle.");
    expect(text).toContain("NYC geography · Illustrative venues · No live location tracking");
    expect(text).toContain("Skip the map");
    expect(html).toContain('href="#connect-agent"');
    for (const label of [
      "THE BRONX",
      "MANHATTAN",
      "QUEENS",
      "BROOKLYN",
      "STATEN ISLAND",
      "HUDSON RIVER",
      "EAST RIVER",
      "NEW YORK HARBOR",
      "ATLANTIC OCEAN",
    ]) {
      expect(html).toContain(label);
    }
    expect(text).toContain("01 Start with New York");
    expect(text).toContain("02 Set your search point");
    expect(text).toContain("03 Explore nearby spaces");
    expect(text).toContain("04 Find your kind of place");
    expect(text).toContain("Scroll to explore");
    expect(html).not.toContain("It searches the neighborhood");
    expect(html).not.toContain("SOHO");
    expect(html).not.toContain('data-motion="on"');
  });
});
