import { afterEach, describe, expect, it, vi } from "vitest";
import { adminEmails, hasDashboardAccess, isAdmin, isMayaChen } from "@/lib/access";

describe("dashboard access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets the demo account in by exact email", () => {
    expect(isMayaChen({ email: "maya@hosty.demo", name: "Maya Chen" })).toBe(true);
    expect(isMayaChen({ email: "Maya@Hosty.demo", name: "Someone" })).toBe(true);
    expect(isMayaChen({ email: "maya@hostkit.demo", name: "Someone" })).toBe(true);
  });

  it("rejects a name-only match", () => {
    expect(isMayaChen({ email: "maya@tryhosty.app", name: "Maya Chen" })).toBe(false);
    expect(isMayaChen({ email: "maya@example.com", name: "  Maya   Chen " })).toBe(false);
    expect(isMayaChen({ email: "sam@babson.edu", name: "Maya Chen" })).toBe(false);
    expect(hasDashboardAccess({ email: "maya@tryhosty.app", name: "Maya Chen", approvedAt: null })).toBe(false);
  });

  it("keeps everyone else out", () => {
    expect(isMayaChen({ email: "sam@babson.edu", name: "Sam Okafor" })).toBe(false);
    expect(isMayaChen({ email: "maya@example.com", name: "Maya" })).toBe(false);
  });

  it("parses ADMIN_EMAILS as a trimmed, case-insensitive list", () => {
    vi.stubEnv("ADMIN_EMAILS", " Admin@Hosty.test, second@hosty.test ,, ");
    expect(adminEmails()).toEqual(["admin@hosty.test", "second@hosty.test"]);
    expect(isAdmin({ email: " ADMIN@hosty.test " })).toBe(true);
    expect(isAdmin({ email: "Second@Hosty.test" })).toBe(true);
    expect(hasDashboardAccess({ email: "second@hosty.test", name: "Hosty", approvedAt: null })).toBe(true);
    expect(isAdmin({ email: "other@hosty.test" })).toBe(false);
  });

  it("treats an unset or blank ADMIN_EMAILS as nobody", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(adminEmails()).toEqual([]);
    expect(isAdmin({ email: "admin@hosty.test" })).toBe(false);
    expect(hasDashboardAccess({ email: "admin@hosty.test", name: "Hosty", approvedAt: null })).toBe(false);

    vi.stubEnv("ADMIN_EMAILS", "  ,  ");
    expect(isAdmin({ email: "admin@hosty.test" })).toBe(false);

    delete process.env.ADMIN_EMAILS;
    expect(adminEmails()).toEqual([]);
    expect(isAdmin({ email: "admin@hosty.test" })).toBe(false);
    expect(hasDashboardAccess({ email: "admin@hosty.test", name: "Anyone", approvedAt: null })).toBe(false);
  });

  it("does not let a lookalike admin address in", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@hosty.test");
    expect(hasDashboardAccess({ email: "admin@hosty.test.evil.com", name: "Hosty", approvedAt: null })).toBe(false);
    expect(hasDashboardAccess({ email: "someone@gmail.com", name: "Hosty", approvedAt: null })).toBe(false);
    expect(hasDashboardAccess({ email: "sam@babson.edu", name: "Sam Okafor", approvedAt: null })).toBe(false);
  });

  it("lets an approved waitlister in, and nobody who isn't", () => {
    delete process.env.ADMIN_EMAILS;
    expect(
      hasDashboardAccess({ email: "sam@babson.edu", name: "Sam Okafor", approvedAt: new Date("2026-09-23") }),
    ).toBe(true);
    expect(hasDashboardAccess({ email: "sam@babson.edu", name: "Sam Okafor", approvedAt: null })).toBe(false);
  });

  it("lets the demo account in without being an administrator", () => {
    delete process.env.ADMIN_EMAILS;
    expect(hasDashboardAccess({ email: "maya@hosty.demo", name: "Maya Chen", approvedAt: null })).toBe(true);
  });
});
