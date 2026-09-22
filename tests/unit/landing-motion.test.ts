import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingPreview } from "@/components/landing-preview";
import { Reveal } from "@/components/reveal";

const landing = readFileSync(
  new URL("../../components/landing.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

describe("landing preview card", () => {
  it("renders the whole example on the server, so it reads without JavaScript", () => {
    const html = renderToStaticMarkup(createElement(LandingPreview));

    expect(html).toContain("You brief it");
    expect(html).toContain("It hands back");
    expect(html).toContain("Mixer");
    expect(html).toContain("Thu 12 March, 8pm");
    expect(html).toContain("Lock the date, headcount and budget");
    expect(html).toContain("Confirm final headcount with the caterer");
    expect(html).toContain("Catering");
    expect(html).toContain("$1,500");
    // Nothing starts hidden: the play state is only ever entered client-side.
    expect(html).not.toContain('data-play="playing"');
    expect(html).not.toContain("Drafting");
  });

  it("is what the landing page mounts in place of the inline card", () => {
    expect(landing).toContain("<LandingPreview />");
    expect(landing).not.toContain("DRAFT_TASKS");
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

  it("wraps the stages, the principles and the closing call to action", () => {
    const uses = landing.match(/<Reveal\b/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(4);
  });
});

describe("hero entrance", () => {
  it("staggers the hero lines and waits for the splash", () => {
    const rises = landing.match(/className="[^"]*\brise\b/g) ?? [];
    expect(rises.length).toBeGreaterThanOrEqual(4);
    expect(css).toContain("@keyframes rise");
    expect(css).toMatch(/html\[data-splash="pending"\] \.rise/);
  });
});

describe("motion is optional", () => {
  it("switches every landing animation off under prefers-reduced-motion", () => {
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain(".rise");
    expect(reduced).toContain(".reveal");
    expect(reduced).toContain(".cloud-drift");
    expect(reduced).toContain('[data-play="playing"]');
  });
});
