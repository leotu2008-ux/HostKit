import { describe, expect, it } from "vitest";
import { isMayaChen } from "@/lib/access";

describe("dashboard access", () => {
  it("lets Maya Chen in", () => {
    expect(isMayaChen({ email: "maya@hostkit.demo", name: "Maya Chen" })).toBe(true);
    expect(isMayaChen({ email: "Maya@HostKit.demo", name: "Someone" })).toBe(true);
    expect(isMayaChen({ email: "maya@tryhosty.app", name: "Maya Chen" })).toBe(true);
  });

  it("keeps everyone else out", () => {
    expect(isMayaChen({ email: "sam@babson.edu", name: "Sam Okafor" })).toBe(false);
    expect(isMayaChen({ email: "maya@example.com", name: "Maya" })).toBe(false);
  });
});
