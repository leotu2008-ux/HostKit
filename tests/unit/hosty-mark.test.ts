import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HostyMark } from "@/components/hosty-mark";

describe("HostyMark", () => {
  it("draws the ghost in currentColor at the requested size, hidden from screen readers by default", () => {
    const html = renderToStaticMarkup(createElement(HostyMark, { size: 32 }));
    expect(html).toContain('width="32"');
    expect(html).toContain('height="32"');
    expect(html).toContain('viewBox="0 0 100 100"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("role=");
  });

  it("defaults to 20px", () => {
    const html = renderToStaticMarkup(createElement(HostyMark));
    expect(html).toContain('width="20"');
  });

  it("becomes a labelled image when given a title", () => {
    const html = renderToStaticMarkup(createElement(HostyMark, { title: "Hosty" }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Hosty"');
    expect(html).toContain("<title>Hosty</title>");
    expect(html).not.toContain("aria-hidden");
  });
});
