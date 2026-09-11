import { describe, expect, it } from "vitest";
import { isPushConfigured, payloadFor } from "@/lib/push/apns";

describe("apns", () => {
  it("is off without the five env vars", () => {
    expect(isPushConfigured()).toBe(false);
  });

  it("builds an alert payload with badge and deep-link data", () => {
    const payload = payloadFor({
      token: "abc",
      title: "Pitch Night",
      body: "BEC just posted it",
      badge: 3,
      data: { eventId: "e1", clubId: null },
    });
    expect(payload).toEqual({
      aps: { alert: { title: "Pitch Night", body: "BEC just posted it" }, sound: "default", badge: 3 },
      eventId: "e1",
      clubId: null,
    });
  });
});
