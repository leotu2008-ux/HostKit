import { describe, expect, it } from "vitest";
import {
  canChangeRole,
  canManageClub,
  canManageEvent,
  hasRole,
  lastOwnerGuard,
  slugify,
  uniqueSlug,
} from "@/lib/clubs";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Brooklyn Run Club")).toBe("brooklyn-run-club");
  });

  it("strips diacritics instead of dropping the letter", () => {
    expect(slugify("Café Noir")).toBe("cafe-noir");
  });

  it("collapses punctuation runs and trims the ends", () => {
    expect(slugify("  --The (Late!) Night... Society-- ")).toBe(
      "the-late-night-society",
    );
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const slug = slugify("a".repeat(30) + " " + "b".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back to something routable for junk input", () => {
    expect(slugify("")).toBe("club");
    expect(slugify("!!! ???")).toBe("club");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug("run-club", () => false)).toBe("run-club");
  });

  it("appends -2, -3 on collision", () => {
    const taken = new Set(["run-club", "run-club-2"]);
    expect(uniqueSlug("run-club", (s) => taken.has(s))).toBe("run-club-3");
  });
});

describe("roles", () => {
  it("ranks owner above admin above member", () => {
    expect(hasRole("OWNER", "ADMIN")).toBe(true);
    expect(hasRole("ADMIN", "OWNER")).toBe(false);
    expect(hasRole("MEMBER", "MEMBER")).toBe(true);
    expect(hasRole(null, "MEMBER")).toBe(false);
  });

  it("lets owners and admins manage, not members or outsiders", () => {
    expect(canManageClub("OWNER")).toBe(true);
    expect(canManageClub("ADMIN")).toBe(true);
    expect(canManageClub("MEMBER")).toBe(false);
    expect(canManageClub(null)).toBe(false);
    expect(canManageClub(undefined)).toBe(false);
  });
});

describe("canManageEvent", () => {
  it("allows the owner of a personal event", () => {
    expect(canManageEvent({ ownerId: "u1" }, "u1")).toBe(true);
    expect(canManageEvent({ ownerId: "u1" }, "u2")).toBe(false);
  });

  it("allows a club admin who is not the creator", () => {
    expect(canManageEvent({ ownerId: "u1", clubRole: "ADMIN" }, "u2")).toBe(true);
  });

  it("refuses a plain club member", () => {
    expect(canManageEvent({ ownerId: "u1", clubRole: "MEMBER" }, "u2")).toBe(false);
  });

  it("refuses a signed-out caller even with a role somehow attached", () => {
    // The role can only come from a user lookup, so a null user with a role
    // is a programming error; fail closed on the ownership check regardless.
    expect(canManageEvent({ ownerId: "u1", clubRole: null }, null)).toBe(false);
  });
});

describe("canChangeRole", () => {
  it("lets an owner do anything", () => {
    expect(canChangeRole("OWNER", "OWNER", "MEMBER")).toBe(true);
    expect(canChangeRole("OWNER", "MEMBER", "OWNER")).toBe(true);
    expect(canChangeRole("OWNER", "ADMIN", null)).toBe(true);
  });

  it("lets an admin shuffle members and admins", () => {
    expect(canChangeRole("ADMIN", "MEMBER", "ADMIN")).toBe(true);
    expect(canChangeRole("ADMIN", "ADMIN", "MEMBER")).toBe(true);
    expect(canChangeRole("ADMIN", "MEMBER", null)).toBe(true);
  });

  it("never lets an admin touch an owner or mint one", () => {
    expect(canChangeRole("ADMIN", "OWNER", "MEMBER")).toBe(false);
    expect(canChangeRole("ADMIN", "OWNER", null)).toBe(false);
    expect(canChangeRole("ADMIN", "MEMBER", "OWNER")).toBe(false);
  });

  it("refuses members and outsiders outright", () => {
    expect(canChangeRole("MEMBER", "MEMBER", "ADMIN")).toBe(false);
    expect(canChangeRole(null, "MEMBER", null)).toBe(false);
  });
});

describe("lastOwnerGuard", () => {
  const members = [
    { userId: "a", role: "OWNER" as const },
    { userId: "b", role: "ADMIN" as const },
    { userId: "c", role: "MEMBER" as const },
  ];

  it("refuses demoting the only owner", () => {
    expect(lastOwnerGuard(members, "a", "ADMIN").ok).toBe(false);
  });

  it("refuses removing the only owner", () => {
    expect(lastOwnerGuard(members, "a", null).ok).toBe(false);
  });

  it("allows the change once there is a second owner", () => {
    const two = [...members, { userId: "d", role: "OWNER" as const }];
    expect(lastOwnerGuard(two, "a", "MEMBER").ok).toBe(true);
    expect(lastOwnerGuard(two, "a", null).ok).toBe(true);
  });

  it("does not interfere with non-owners", () => {
    expect(lastOwnerGuard(members, "b", null).ok).toBe(true);
    expect(lastOwnerGuard(members, "c", "ADMIN").ok).toBe(true);
  });

  it("is a no-op when an owner stays an owner", () => {
    expect(lastOwnerGuard(members, "a", "OWNER").ok).toBe(true);
  });

  it("rejects an unknown member with a reason", () => {
    const result = lastOwnerGuard(members, "zzz", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/isn't a member/);
  });
});
