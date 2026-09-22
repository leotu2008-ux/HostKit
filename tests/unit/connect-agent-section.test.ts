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

import { ConnectAgentSection } from "@/components/connect-agent-section";

describe("Connect an agent landing section", () => {
  it("says Cursor and Claude can read Hosty, and links to /mcp for setup", () => {
    const html = renderToStaticMarkup(createElement(ConnectAgentSection));

    expect(html).toContain("Connect an agent");
    expect(html).toContain(
      "Cursor and Claude can connect to Hosty to read events, guests, campus events, and Discover.",
    );
    expect(html).toContain("Events");
    expect(html).toContain("Guests");
    expect(html).toContain("Campus events");
    expect(html).toContain("Discover");
    expect(html).toContain('href="/mcp"');
    expect(html).toContain("Endpoint, token generation, and setup config");
    expect(html).not.toContain("HostKit");
  });

  it("sits after the hero and before the workflow", () => {
    const landing = readFileSync(
      new URL("../../components/landing.tsx", import.meta.url),
      "utf8",
    );
    const hero = landing.indexOf("Plan the event.");
    const section = landing.indexOf("<ConnectAgentSection");
    const workflow = landing.indexOf("The agent works every stage");

    expect(hero).toBeGreaterThan(-1);
    expect(section).toBeGreaterThan(hero);
    expect(workflow).toBeGreaterThan(section);
  });
});
