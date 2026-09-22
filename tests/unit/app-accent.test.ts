import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Selected and primary controls in the signed-in app use the accent token,
 * which is blue there and ink everywhere else. A hard-coded `bg-ink` or
 * `border-ink` would stay black inside the blue app. Scrims such as
 * `bg-ink/30` are fine: the `/` suffix is excluded.
 */
const FILES = [
  "components/workspace-sidebar.tsx",
  "components/section-nav.tsx",
  "components/outreach-card.tsx",
  "components/inquiry-panel.tsx",
  "components/blast-composer.tsx",
  "components/calendar-picker.tsx",
  "components/club-browse.tsx",
  "components/activity-feed.tsx",
  "app/(workspace)/events/[id]/(guests)/promote/page.tsx",
];

const HARD_INK = /\b(?:bg|border)-ink(?![-/\w])/g;

describe("signed-in accent", () => {
  it.each(FILES)("%s paints selection and primaries with the accent", (file) => {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    expect(source.match(HARD_INK) ?? []).toEqual([]);
  });

  it("marks the active workspace tab with the accent", () => {
    const source = readFileSync(new URL("../../components/workspace-sidebar.tsx", import.meta.url), "utf8");
    expect(source).toContain("bg-clay-wash font-medium text-clay-deep");
  });
});
