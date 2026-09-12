import { describe, expect, it } from "vitest";
import { normalizeHandle, socialDisplay, socialUrl } from "@/lib/socials";
import { normalizeProfile, profileSchema } from "@/lib/profile";

describe("normalizeHandle", () => {
  it("boils handles, @handles and links down to the handle", () => {
    expect(normalizeHandle("x", "@leo_tu")).toBe("leo_tu");
    expect(normalizeHandle("x", "https://twitter.com/leo_tu?s=20")).toBe("leo_tu");
    expect(normalizeHandle("x", "x.com/leo_tu")).toBe("leo_tu");
    expect(normalizeHandle("linkedin", "https://www.linkedin.com/in/leo-tu-123/")).toBe("leo-tu-123");
    expect(normalizeHandle("linkedin", "leo-tu-123")).toBe("leo-tu-123");
    expect(normalizeHandle("instagram", "@leo.tu")).toBe("leo.tu");
    expect(normalizeHandle("instagram", "https://instagram.com/leo.tu/")).toBe("leo.tu");
    expect(normalizeHandle("x", "  ")).toBeNull();
  });

  it("refuses the wrong site or a bad handle", () => {
    expect(() => normalizeHandle("x", "https://instagram.com/leo")).toThrow(/isn't a X link/);
    expect(() => normalizeHandle("x", "way too long for x handles")).toThrow(/doesn't look right/);
    expect(() => normalizeHandle("instagram", "has space")).toThrow();
  });

  it("builds links and display names", () => {
    expect(socialUrl("x", "leo")).toBe("https://x.com/leo");
    expect(socialUrl("linkedin", "leo")).toBe("https://www.linkedin.com/in/leo");
    expect(socialUrl("instagram", "leo")).toBe("https://www.instagram.com/leo");
    expect(socialDisplay("x", "leo")).toBe("@leo");
    expect(socialDisplay("linkedin", "leo")).toBe("leo");
  });
});

describe("profileSchema socials", () => {
  it("normalizes into handle columns and clears with empty strings", () => {
    const ok = profileSchema.safeParse({ x: "@leo", linkedin: "linkedin.com/in/leo", instagram: "" });
    expect(ok.success && normalizeProfile(ok.data)).toEqual({ xHandle: "leo", linkedinHandle: "leo", instagramHandle: null });
    const bad = profileSchema.safeParse({ x: "https://instagram.com/leo" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].message).toMatch(/X link/);
  });
});
