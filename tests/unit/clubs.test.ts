import { describe, expect, it } from "vitest";
import { clubSchema, suggestHandle } from "@/lib/clubs";

describe("suggestHandle", () => {
  it("slugs a name", () => {
    expect(suggestHandle("Babson Entrepreneurship Club")).toBe("babson-entrepreneurship-club");
    expect(suggestHandle("  Ski & Board!! ")).toBe("ski-board");
  });

  it("avoids reserved and too-short handles", () => {
    expect(suggestHandle("New")).toBe("new-club");
    expect(suggestHandle("Go")).toBe("go-club");
  });

  it("stays within 30 characters", () => {
    expect(suggestHandle("The Very Long Name Of A Society That Goes On").length).toBeLessThanOrEqual(30);
  });
});

describe("clubSchema", () => {
  it("lowercases and validates the handle", () => {
    const ok = clubSchema.safeParse({ name: "Chess Club", handle: "Chess-Club" });
    expect(ok.success && ok.data.handle).toBe("chess-club");
  });

  it("rejects bad or reserved handles", () => {
    expect(clubSchema.safeParse({ name: "Chess Club", handle: "ab" }).success).toBe(false);
    expect(clubSchema.safeParse({ name: "Chess Club", handle: "chess club" }).success).toBe(false);
    expect(clubSchema.safeParse({ name: "Chess Club", handle: "new" }).success).toBe(false);
  });
});
