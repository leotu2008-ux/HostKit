import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));

import PrivacyPage from "@/app/privacy/page";

describe("/privacy", () => {
  it("renders the policy with the contact email", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain("<h1");
    expect(html).toContain('href="mailto:leowomc@gmail.com"');
  });
});
