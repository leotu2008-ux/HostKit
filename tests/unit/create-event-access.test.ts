import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  eventCreate: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/session", () => ({ currentProfile: mocks.profile }));
vi.mock("@/lib/db", () => ({ db: { event: { create: mocks.eventCreate } } }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createBlankEventAction } from "@/lib/actions/events";

describe("createBlankEventAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a signed-out visitor to the waitlist and creates nothing", async () => {
    mocks.profile.mockResolvedValue(null);
    await expect(createBlankEventAction()).rejects.toThrow("REDIRECT /signup");
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("sends a caller without access to the waitlist and creates nothing", async () => {
    mocks.profile.mockResolvedValue({
      id: "u-1",
      email: "sam@babson.edu",
      name: "Sam Okafor",
      approvedAt: null,
      schoolDomain: null,
    });
    await expect(createBlankEventAction()).rejects.toThrow("REDIRECT /signup");
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});
