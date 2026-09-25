import { describe, expect, it, vi } from "vitest";

// The root layout pulls in fonts and the app frame (and through it the auth
// library); only its exported metadata is under test here.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter" }),
  EB_Garamond: () => ({ variable: "font-garamond" }),
}));
vi.mock("@/components/app-frame", () => ({ AppFrame: () => null }));
vi.mock("@/components/launch-splash", () => ({ LaunchSplash: () => null }));

import { metadata } from "@/app/layout";

describe("the site description", () => {
  const description = String(metadata.description);

  it("pitches Hosty to any host as time saved", () => {
    expect(description).toContain("saves you hours on any event");
    expect(description).not.toMatch(/recurring/i);
  });

  it("is what search results and link previews show", () => {
    expect(metadata.openGraph?.description).toBe(description);
    expect(metadata.twitter?.description).toBe(description);
  });

  it("keeps the promise that the host presses send, and drops the old consumer copy", () => {
    expect(description).toContain("You approve every send.");
    expect(description).not.toContain("Find a night");
    expect(description).not.toContain("register in a tap");
  });
});
