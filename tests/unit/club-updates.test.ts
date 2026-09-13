import { describe, expect, it } from "vitest";
import { CLUB_CATEGORIES, clubCategoryLabel, clubPostSchema, clubSchema, isClubCategory } from "@/lib/club-format";

describe("club categories", () => {
  it("knows its keys and labels", () => {
    expect(isClubCategory("social")).toBe(true);
    expect(isClubCategory("nope")).toBe(false);
    expect(clubCategoryLabel("sports")).toBe(CLUB_CATEGORIES.sports);
    expect(clubCategoryLabel(null)).toBeNull();
  });

  it("is optional on the club form and validated when set", () => {
    expect(clubSchema.safeParse({ name: "Chess Club", handle: "chess-club", category: "" }).success).toBe(true);
    expect(clubSchema.safeParse({ name: "Chess Club", handle: "chess-club", category: "academic" }).success).toBe(true);
    expect(clubSchema.safeParse({ name: "Chess Club", handle: "chess-club", category: "party" }).success).toBe(false);
  });
});

describe("club updates", () => {
  it("need a body under 500 characters", () => {
    expect(clubPostSchema.safeParse({ body: "  " }).success).toBe(false);
    expect(clubPostSchema.safeParse({ body: "Doors at 7." }).success).toBe(true);
    expect(clubPostSchema.safeParse({ body: "x".repeat(501) }).success).toBe(false);
  });
});
