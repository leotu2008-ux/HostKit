import { describe, expect, it } from "vitest";
import { shouldPlaySplash, SPLASH_STORAGE_KEY } from "@/lib/splash";

describe("shouldPlaySplash", () => {
  it("plays once for a fresh session that allows motion", () => {
    expect(shouldPlaySplash(false, false)).toBe(true);
  });

  it("does not replay after the session has already seen it", () => {
    expect(shouldPlaySplash(true, false)).toBe(false);
  });

  it("skips the animation when the user prefers reduced motion", () => {
    expect(shouldPlaySplash(false, true)).toBe(false);
    expect(shouldPlaySplash(true, true)).toBe(false);
  });
});

describe("SPLASH_STORAGE_KEY", () => {
  it("is a stable sessionStorage key", () => {
    expect(SPLASH_STORAGE_KEY).toBe("hosty-splash-seen");
  });
});
