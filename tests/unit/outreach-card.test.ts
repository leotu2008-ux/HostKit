import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", props, children),
}));

vi.mock("@/lib/actions/collaborators", () => ({
  removeCollaboratorAction: vi.fn(),
  saveCollaboratorMessageAction: vi.fn(),
  sendCollaboratorAction: vi.fn(),
  setCollaboratorStatusAction: vi.fn(),
}));

import { OutreachCard } from "@/components/outreach-card";
import type { OutreachRow } from "@/lib/api/outreach";

function row(over: Partial<OutreachRow> = {}): OutreachRow {
  return {
    id: "c1",
    kind: "VENUE",
    name: "Riverside Hall",
    detail: null,
    email: "events@riverside.example",
    phone: null,
    website: null,
    status: "PENDING",
    source: "collaborator",
    listingPath: null,
    subject: "Venue inquiry",
    message: "Hi Riverside Hall, is the 12th free?",
    sentAt: null,
    canSend: true,
    ...over,
  };
}

const render = (r: OutreachRow) => renderToStaticMarkup(createElement(OutreachCard, { row: r, eventId: "e1" }));

/** The text of every <button> on the card, tags stripped. */
const buttons = (html: string) =>
  [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]*>/g, ""));

describe("OutreachCard", () => {
  it("opens a drafted row so the host can read it and send it in one pass", () => {
    const html = render(row());

    expect(html).toContain("<textarea");
    expect(html).toContain("is the 12th free?");
    expect(buttons(html)).toContain("Hide message");
    expect(buttons(html)).toContain("Send to Riverside Hall");
    expect(buttons(html)).not.toContain("Send it");
  });

  it("keeps a drafted vendor inquiry closed, since it sends from its listing page", () => {
    const html = render(
      row({ source: "inquiry", kind: "VENDOR", name: "Taco Cart", listingPath: "/listings/l1?event=e1", canSend: false }),
    );

    expect(html).not.toContain("<textarea");
    expect(buttons(html)).toContain("Draft message");
  });

  it("keeps a draft closed while there's no email to send it to", () => {
    const html = render(row({ email: null, canSend: false }));

    expect(html).not.toContain("<textarea");
    expect(buttons(html)).toContain("Draft message");
  });

  it("keeps a row closed once it has been asked", () => {
    const html = render(row({ sentAt: new Date("2026-09-20T12:00:00Z"), canSend: false }));

    expect(html).not.toContain("<textarea");
    expect(buttons(html)).toContain("Draft message");
  });

  it("keeps a confirmed row closed", () => {
    const html = render(row({ status: "CONFIRMED" }));

    expect(html).not.toContain("<textarea");
    expect(buttons(html)).toContain("Draft message");
  });
});
