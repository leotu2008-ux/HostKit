import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import nextConfig from "@/next.config";
import { DesktopNav, TabBar } from "@/components/tab-bar";

describe("the consumer web pages are gone", () => {
  it("sends Discover, campus and club URLs home, temporarily so they can come back", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    for (const source of ["/discover", "/discover/:path*", "/campus", "/campus/:path*", "/c/:path*", "/clubs", "/clubs/:path*"]) {
      expect(redirects).toContainEqual({ source, destination: "/", permanent: false });
    }
  });

  it("leaves the host's vendor scouting alone", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects.some((r) => r.source.startsWith("/events"))).toBe(false);
  });

  it("drops Discover from the desktop nav and the phone tab bar", () => {
    for (const component of [DesktopNav, TabBar]) {
      const html = renderToStaticMarkup(createElement(component));
      expect(html).not.toContain('href="/discover"');
      expect(html).not.toContain("Discover");
      expect(html).toContain('href="/events"');
    }
  });

  it("gives the phone tab bar one column per tab", () => {
    const html = renderToStaticMarkup(createElement(TabBar));
    const columns = Number(html.match(/grid-template-columns:repeat\((\d+), minmax\(0, 1fr\)\)/)?.[1]);
    expect(columns).toBe(html.match(/<li/g)?.length);
    expect(columns).toBe(3);
  });
});
