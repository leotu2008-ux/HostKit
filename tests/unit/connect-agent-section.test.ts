import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
  }) => createElement("a", { href, className }, children),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    createElement("img", { src, alt, className }),
}));

import { ConnectAgentSection } from "@/components/connect-agent-section";

describe("Connect an agent landing section", () => {
  it("says Claude, ChatGPT and Cursor can read Hosty, and links to /mcp for setup", () => {
    const html = renderToStaticMarkup(createElement(ConnectAgentSection));

    expect(html).toContain("Connect an agent");
    expect(html).toContain("Claude, ChatGPT and Cursor");
    // The intro waves word by word, so read its text rather than its markup.
    expect(html.replace(/<[^>]+>/g, "")).toContain(
      "Claude and ChatGPT can read your events and briefs and search venues. Cursor can read your events and guest lists.",
    );
    const tiles = ["Events", "Briefs", "Guests", "Venues"].map((tile) => html.indexOf(`>${tile}</li>`));
    expect(tiles.every((at) => at > -1)).toBe(true);
    expect(tiles).toEqual([...tiles].sort((a, b) => a - b));
    // Hosty is B2B: no consumer reads advertised.
    expect(html).not.toContain("Campus events");
    expect(html).not.toContain("Discover");
    expect(html).toContain('href="/mcp"');
    expect(html).toContain("Endpoint, token generation, and setup config");
    expect(html).not.toContain("HostKit");
  });

  it("invites you to add your preferred LLM, with the Claude, ChatGPT and Gemini marks", () => {
    const html = renderToStaticMarkup(createElement(ConnectAgentSection));

    expect(html).toContain("Add your preferred LLM");
    for (const [name, logo] of [
      ["Claude", "/llm/claude-color.svg"],
      ["ChatGPT", "/llm/openai.svg"],
      ["Gemini", "/llm/gemini-color.svg"],
    ]) {
      expect(html).toContain(name);
      expect(html).toContain(`src="${logo}"`);
    }
  });

  it("sits after the four stages", () => {
    const landing = readFileSync(
      new URL("../../components/landing.tsx", import.meta.url),
      "utf8",
    );
    const workflow = landing.indexOf("The agent works every stage");
    const stagesEnd = landing.indexOf("</ol>", workflow);
    const section = landing.indexOf("<ConnectAgentSection");
    const next = landing.indexOf("Why you can leave it alone");

    expect(workflow).toBeGreaterThan(-1);
    expect(stagesEnd).toBeGreaterThan(workflow);
    expect(section).toBeGreaterThan(stagesEnd);
    expect(next).toBeGreaterThan(section);
  });
});
