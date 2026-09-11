import { describe, expect, it } from "vitest";
import { paperFor, parsePreference, resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  it("honours an explicit light or dark choice", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the device when set to system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("parsePreference", () => {
  it("falls back to system for unknown values", () => {
    expect(parsePreference("nope")).toBe("system");
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference(undefined)).toBe("system");
  });
});

describe("paperFor", () => {
  it("returns the status-bar paper colour for each resolved theme", () => {
    expect(paperFor("light")).toBe("#fbf8f4");
    expect(paperFor("dark")).toBe("#161310");
  });
});
