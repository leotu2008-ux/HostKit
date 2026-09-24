import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendEmails: vi.fn(async () => 1) }));

vi.mock("@/lib/db", () => ({
  db: {
    notification: { createMany: vi.fn(async () => ({ count: 1 })) },
    user: { findMany: vi.fn(async () => [{ email: "sam@babson.edu" }]) },
  },
}));
vi.mock("@/lib/email/send", () => ({ isEmailConfigured: () => true, sendEmails: mocks.sendEmails }));
vi.mock("@/lib/push/apns", () => ({ isPushConfigured: () => false, sendPush: vi.fn() }));

import { notify } from "@/lib/notify";

describe("notify email", () => {
  it("still sends text when a notice has no body", async () => {
    await notify(["u-sam"], { kind: "club_update", title: "Chess Club: Doors at 7.", body: "" });
    expect(mocks.sendEmails).toHaveBeenCalledWith([
      { to: "sam@babson.edu", subject: "Chess Club: Doors at 7.", text: "Chess Club: Doors at 7." },
    ]);
  });
});
