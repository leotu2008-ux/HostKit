import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

describe("buttons: soft and tactile", () => {
  const primary = classes(createElement(Button, null, "Publish"));

  it("shows a keyboard focus ring", () => {
    expect(primary).toContain("focus-visible:outline-2");
    expect(primary.some((c) => c.startsWith("focus-visible:outline-offset"))).toBe(true);
  });

  it("lifts on hover and presses in on click", () => {
    expect(primary).toContain("hover:-translate-y-px");
    expect(primary.some((c) => c.startsWith("active:scale-"))).toBe(true);
  });

  it("never moves when disabled or when motion is reduced", () => {
    expect(primary).toContain("disabled:translate-y-0");
    expect(primary).toContain("motion-reduce:transform-none");
  });

  it("gives primary buttons a gradient and a glow", () => {
    expect(primary.some((c) => c.startsWith("bg-[linear-gradient"))).toBe(true);
    expect(primary.some((c) => c.startsWith("shadow-["))).toBe(true);
  });

  it("keeps a 44px tap target on phones even for small buttons", () => {
    const small = classes(createElement(Button, { size: "sm" }, "Mark done"));
    expect(small).toContain("min-h-11");
    expect(small.some((c) => c.startsWith("md:min-h-["))).toBe(true);
  });

  it("doesn't lift ghost buttons", () => {
    const ghost = classes(createElement(Button, { variant: "ghost" }, "Cancel"));
    expect(ghost).toContain("hover:translate-y-0");
  });

  it("styles links the same way", () => {
    const link = classes(createElement(ButtonLink, { href: "/signup", variant: "brand", size: "lg" }, "Join the waitlist"));
    expect(link).toContain("focus-visible:outline-2");
    expect(link.some((c) => c.startsWith("bg-[linear-gradient"))).toBe(true);
  });
});
