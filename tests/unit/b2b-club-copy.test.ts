import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notify: vi.fn(async () => 0),
  postCreate: vi.fn(async () => ({ id: "p1" })),
  followers: vi.fn(async () => [{ userId: "u-author" }, { userId: "u-sam" }]),
  notifications: vi.fn(async () => []),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement("a", { href }, children),
}));
vi.mock("@/lib/notify", () => ({ notify: mocks.notify }));
vi.mock("@/lib/db", () => ({
  db: {
    clubPost: { create: mocks.postCreate },
    follow: { findMany: mocks.followers },
    notification: { findMany: mocks.notifications },
  },
}));
vi.mock("@/lib/session", () => ({ requireUser: async () => ({ id: "u-sam" }) }));
vi.mock("@/lib/actions/inbox", () => ({ markInboxReadAction: async () => {} }));

import { postClubUpdate } from "@/lib/clubs";
import InboxPage from "@/app/(app)/inbox/page";

const CLUB = { id: "c1", name: "Chess Club" };

describe("club updates on the B2B web", () => {
  beforeEach(() => mocks.notify.mockClear());

  it("tells followers the whole short update without sending them to a club page", async () => {
    await postClubUpdate(CLUB, "u-author", "Doors at 7.");
    expect(mocks.notify).toHaveBeenCalledWith(["u-sam"], {
      kind: "club_update",
      title: "Chess Club: Doors at 7.",
      body: "Doors at 7.",
      clubId: "c1",
    });
  });

  it("keeps the full text of a long update in the body", async () => {
    const long = "x".repeat(90);
    await postClubUpdate(CLUB, "u-author", long);
    expect(mocks.notify).toHaveBeenCalledWith(
      ["u-sam"],
      expect.objectContaining({ title: `Chess Club: ${"x".repeat(69)}…`, body: long }),
    );
  });

  it("describes an empty Inbox without clubs you follow", async () => {
    const html = renderToStaticMarkup(await InboxPage());
    expect(html).toContain("Nothing yet");
    expect(html).toContain("a host confirms your spot");
    expect(html).not.toMatch(/club/i);
  });
});
