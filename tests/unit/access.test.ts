import { describe, expect, it } from "vitest";
import { hasDashboardAccess, isMayaChen } from "@/lib/access";

describe("dashboard access", () => {
  it("lets Maya Chen in", () => {
    expect(isMayaChen({ email: "maya@hosty.demo", name: "Maya Chen" })).toBe(true);
    expect(isMayaChen({ email: "Maya@Hosty.demo", name: "Someone" })).toBe(true);
    expect(isMayaChen({ email: "maya@tryhosty.app", name: "Maya Chen" })).toBe(true);
  });

  it("keeps everyone else out", () => {
    expect(isMayaChen({ email: "sam@babson.edu", name: "Sam Okafor" })).toBe(false);
    expect(isMayaChen({ email: "maya@example.com", name: "Maya" })).toBe(false);
  });

  it("lets the Hosty admin in alongside Maya", () => {
    expect(hasDashboardAccess({ email: "leowomc@gmail.com", name: "Hosty", approvedAt: null })).toBe(true);
    expect(hasDashboardAccess({ email: " LeoWoMC@Gmail.com ", name: "Anyone", approvedAt: null })).toBe(true);
    expect(hasDashboardAccess({ email: "maya@hosty.demo", name: "Maya Chen", approvedAt: null })).toBe(true);
  });

  it("does not let a lookalike admin address in", () => {
    expect(hasDashboardAccess({ email: "leowomc@gmail.com.evil.com", name: "Hosty", approvedAt: null })).toBe(false);
    expect(hasDashboardAccess({ email: "someone@gmail.com", name: "Hosty", approvedAt: null })).toBe(false);
    expect(hasDashboardAccess({ email: "sam@babson.edu", name: "Sam Okafor", approvedAt: null })).toBe(false);
  });

  it("lets an approved waitlister in, and nobody who isn't", () => {
    expect(
      hasDashboardAccess({ email: "sam@babson.edu", name: "Sam Okafor", approvedAt: new Date("2026-09-23") }),
    ).toBe(true);
    expect(hasDashboardAccess({ email: "sam@babson.edu", name: "Sam Okafor", approvedAt: null })).toBe(false);
  });
});
