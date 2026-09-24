import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

import { Button, ButtonLink } from "@/components/ui";

/** The rendered button's class list. */
function classes(element: ReturnType<typeof createElement>): string[] {
  const html = renderToStaticMarkup(element);
  return html.match(/class="([^"]*)"/)![1].split(/\s+/);
}

const tailwindDir = dirname(createRequire(import.meta.url).resolve("tailwindcss/package.json"));

type Rule = { media: string | null; selector: string; body: string };

/** The class rules Tailwind generates for a rendered button, in cascade order. */
async function rules(element: ReturnType<typeof createElement>): Promise<Rule[]> {
  // A fresh compiler each time: one keeps every class it has ever built.
  const compiler = await compile('@import "tailwindcss/theme"; @import "tailwindcss/utilities";', {
    base: tailwindDir,
    loadStylesheet: async (id, base) => {
      const path = join(tailwindDir, `${id.replace("tailwindcss/", "")}.css`);
      return { path, base, content: await readFile(path, "utf8") };
    },
  });
  const css = compiler.build(classes(element));
  const out: Rule[] = [];
  const open: string[] = [];
  let text = "";
  for (const ch of css) {
    if (ch === "{") {
      open.push(text.slice(text.lastIndexOf(";") + 1).trim());
      text = "";
    } else if (ch === "}") {
      const head = open.pop()!;
      if (head.startsWith(".")) {
        out.push({ media: open.findLast((h) => h.startsWith("@media")) ?? null, selector: head, body: text });
      }
      text = "";
    } else {
      text += ch;
    }
  }
  return out;
}

/** The value `rule` gives `property`, if it sets it. */
function value(rule: Rule, property: string): string | undefined {
  for (const declaration of rule.body.split(";")) {
    const colon = declaration.indexOf(":");
    if (declaration.slice(0, colon).trim() === property) return declaration.slice(colon + 1).trim();
  }
}

const setting = (list: Rule[], property: string) => list.filter((r) => value(r, property) !== undefined);

describe("buttons: soft and tactile", () => {
  const primary = createElement(Button, null, "Publish");

  it("shows a keyboard focus ring", () => {
    expect(classes(primary)).toContain("focus-visible:outline-2");
    expect(classes(primary).some((c) => c.startsWith("focus-visible:outline-offset"))).toBe(true);
  });

  it("lifts on hover and presses in on click, easing both", async () => {
    const css = await rules(primary);
    expect(setting(css, "translate").some((r) => r.selector.endsWith(":hover"))).toBe(true);
    expect(setting(css, "scale").some((r) => r.selector.endsWith(":active"))).toBe(true);
    const transition = setting(css, "transition-property").find((r) => r.media === null)!;
    expect(value(transition, "transition-property")!.split(",")).toEqual(
      expect.arrayContaining(["translate", "scale", "box-shadow"]),
    );
  });

  it("holds still when motion is reduced, even while hovered or pressed", async () => {
    const reduced = (await rules(primary)).filter((r) => r.media?.includes("prefers-reduced-motion: reduce"));
    // !important, because a :hover or :active rule outranks a plain class.
    expect(reduced.map((r) => value(r, "translate")).filter(Boolean)).toEqual(["none !important"]);
    expect(reduced.map((r) => value(r, "scale")).filter(Boolean)).toEqual(["none !important"]);
    expect(reduced.map((r) => value(r, "transition-property")).filter(Boolean)).toEqual(["none"]);
  });

  it("never lifts or presses in when disabled", async () => {
    const css = (await rules(primary)).filter((r) => !r.media?.includes("prefers-reduced-motion"));
    for (const property of ["translate", "scale"]) {
      const last = setting(css, property).at(-1)!;
      expect(last.selector.endsWith(":disabled")).toBe(true);
      expect(value(last, property)).toBe("none");
    }
  });

  it("drops the glow when disabled but keeps a secondary button's hairline", async () => {
    const disabledShadow = async (variant: "primary" | "secondary") => {
      const last = setting(await rules(createElement(Button, { variant, disabled: true }, "Save")), "--tw-shadow").at(-1)!;
      expect(last.selector.endsWith(":disabled")).toBe(true);
      return value(last, "--tw-shadow");
    };
    expect(await disabledShadow("primary")).toBe("0 0 #0000");
    expect(await disabledShadow("secondary")).toMatch(/^0 0 0 1px /);
  });

  it("gives primary buttons a gradient and a glow", () => {
    expect(classes(primary).some((c) => c.startsWith("bg-[linear-gradient"))).toBe(true);
    expect(classes(primary).some((c) => c.startsWith("shadow-["))).toBe(true);
  });

  it("keeps a 44px tap target on phones and tightens from md up", async () => {
    const expected = { sm: ["2.75rem", "34px"], md: ["2.75rem", "42px"], lg: ["3rem", "50px"] } as const;
    for (const [size, [phone, wide]] of Object.entries(expected)) {
      const css = await rules(createElement(Button, { size: size as keyof typeof expected }, "Go"));
      expect(setting(css, "min-height").map((r) => value(r, "min-height"))).toEqual(["var(--button-h)"]);
      expect(setting(css, "--button-h").map((r) => [r.media, value(r, "--button-h")])).toEqual([
        [null, phone],
        ["@media (width >= 48rem)", wide],
      ]);
    }
  });

  it("lets a caller's own min-height win at every width", async () => {
    const css = await rules(createElement(Button, { className: "min-h-12" }, "Check in"));
    const minHeights = setting(css, "min-height");
    expect(minHeights.every((r) => r.media === null)).toBe(true);
    expect(minHeights.at(-1)!.selector).toBe(".min-h-12");
  });

  it("doesn't lift ghost buttons", () => {
    const ghost = classes(createElement(Button, { variant: "ghost" }, "Cancel"));
    expect(ghost).not.toContain("hover:-translate-y-px");
  });

  it("styles links the same way", () => {
    const link = classes(createElement(ButtonLink, { href: "/signup", variant: "brand", size: "lg" }, "Join the waitlist"));
    expect(link).toContain("focus-visible:outline-2");
    expect(link.some((c) => c.startsWith("bg-[linear-gradient"))).toBe(true);
  });
});
