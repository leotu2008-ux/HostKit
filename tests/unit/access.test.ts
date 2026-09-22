import { describe, expect, it } from "vitest";
import { hasDashboardAccess, isMayaChen } from "@/lib/access";

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

  it("lets the Hosty admin in alongside Maya", () => {
    expect(hasDashboardAccess({ email: "hosty@hosty.app", name: "Hosty" })).toBe(true);
    expect(hasDashboardAccess({ email: " Hosty@Hosty.app ", name: "Anyone" })).toBe(true);
    expect(hasDashboardAccess({ email: "maya@hostkit.demo", name: "Maya Chen" })).toBe(true);
  });

  it("does not let a lookalike admin address in", () => {
    expect(hasDashboardAccess({ email: "hosty@hosty.app.evil.com", name: "Hosty" })).toBe(false);
    expect(hasDashboardAccess({ email: "admin@hosty.app", name: "Hosty" })).toBe(false);
    expect(hasDashboardAccess({ email: "sam@babson.edu", name: "Sam Okafor" })).toBe(false);
  });
});
