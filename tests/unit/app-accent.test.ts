import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", props, children),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    createElement("img", { src, alt, className }),
}));

vi.mock("@/lib/actions/events", () => ({ createBlankEventAction: vi.fn() }));
vi.mock("@/lib/actions/inquiries", () => ({
  deleteInquiryAction: vi.fn(),
  sendInquiryAction: vi.fn(),
  startInquiryAction: vi.fn(),
  updateInquiryAction: vi.fn(),
}));

import { InquiryPanel } from "@/components/inquiry-panel";
import { SectionNav } from "@/components/section-nav";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";

type Rendered = { classes: Set<string>; text: string };

/** Every rendered element whose opening tag matches `attr`: its class tokens
 *  and the text up to its closing tag. */
function elements(html: string, attr: RegExp): Rendered[] {
  return [...html.matchAll(/<([a-z0-9]+)\b[^>]*>/g)]
    .filter(([tag]) => attr.test(tag))
    .map(([tag, name], i, all) => {
      const start = all[i].index + tag.length;
      const end = html.indexOf(`</${name}>`, start);
      return {
        classes: new Set(/\bclass="([^"]*)"/.exec(tag)?.[1].split(/\s+/) ?? []),
        text: html.slice(start, end).replace(/<[^>]*>/g, ""),
      };
    });
}

/** Selected and primary controls in the signed-in app use the accent token,
 *  which is blue there. A hard-coded ink fill or border would stay black. */
function expectAccent(classes: Set<string>, accent: string[]) {
  for (const token of accent) expect(classes).toContain(token);
  expect(classes).not.toContain("bg-ink");
  expect(classes).not.toContain("border-ink");
}

describe("signed-in accent", () => {
  it("underlines the active section tab with the accent", () => {
    nav.pathname = "/events/e1/budget";
    const html = renderToStaticMarkup(
      createElement(SectionNav, {
        label: "Planning",
        items: [
          { href: "/events/e1/plan", label: "Plan" },
          { href: "/events/e1/budget", label: "Budget" },
        ],
      }),
    );

    const active = elements(html, /aria-current="page"/);
    expect(active.map((a) => a.text)).toEqual(["Budget"]);
    expectAccent(active[0].classes, ["border-clay", "text-clay-deep"]);
  });

  it("marks the active workspace tab with the accent wash and ring", () => {
    nav.pathname = "/events/e1/runsheet";
    const html = renderToStaticMarkup(
      createElement(WorkspaceSidebar, {
        eventId: "e1",
        title: "Mixer",
        switcher: [],
        agent: { status: "idle", lastRunAt: null, startedAt: null, needs: [] },
        now: new Date(0).toISOString(),
      }),
    );

    const active = elements(html, /aria-current="page"/);
    expect(active.map((a) => a.text)).toEqual(["Planning"]);
    expectAccent(active[0].classes, ["bg-clay-wash", "text-clay-deep", "ring-clay/20"]);
  });

  it("fills the inquiry send button with the accent", () => {
    const html = renderToStaticMarkup(
      createElement(InquiryPanel, {
        eventId: "e1",
        vendorName: "Taco Cart",
        subject: "Mixer",
        inquiry: {
          id: "i1",
          status: "DRAFT",
          message: "Hi",
          quotedCents: null,
          toEmail: "events@venue.com",
        },
      }),
    );

    const send = elements(html, /<button\b/).filter((b) => b.text === "Send to Taco Cart");
    expect(send).toHaveLength(1);
    expectAccent(send[0].classes, ["bg-clay", "text-on-clay"]);
  });
});
