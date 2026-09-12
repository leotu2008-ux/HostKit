import { describe, expect, it } from "vitest";
import { normalizeProfile, profileSchema } from "@/lib/profile";

describe("profileSchema", () => {
  it("accepts a known school, a company, and clears both with empty strings", () => {
    const full = profileSchema.safeParse({ name: "Leo", schoolDomain: "MIT.edu", company: " Acme ", bio: "" });
    expect(full.success).toBe(true);
    if (!full.success) return;
    expect(normalizeProfile(full.data)).toEqual({ name: "Leo", schoolDomain: "mit.edu", company: "Acme", bio: null });

    const cleared = profileSchema.safeParse({ schoolDomain: "", company: "" });
    expect(cleared.success && normalizeProfile(cleared.data)).toEqual({ schoolDomain: null, company: null });
  });

  it("rejects an unknown school and only touches the keys sent", () => {
    expect(profileSchema.safeParse({ schoolDomain: "evil.com" }).success).toBe(false);
    const only = profileSchema.safeParse({ showOnGuestLists: "on" });
    expect(only.success && normalizeProfile(only.data)).toEqual({ showOnGuestLists: true });
  });
});
