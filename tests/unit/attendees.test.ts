import { describe, expect, it } from "vitest";
import { firstNameOf, goingSentence } from "@/lib/attendees";

describe("goingSentence", () => {
  it("names the first two and counts the rest", () => {
    expect(goingSentence(["Ada", "Grace", "Alan"], 14)).toBe("Ada, Grace and 12 others are going");
    expect(goingSentence(["Ada", "Grace"], 3)).toBe("Ada, Grace and 1 other are going");
    expect(goingSentence(["Ada", "Grace"], 2)).toBe("Ada and Grace are going");
    expect(goingSentence(["Ada"], 1)).toBe("Ada is going");
  });

  it("handles nobody visible, and nobody at all", () => {
    expect(goingSentence([], 5)).toBe("5 are going");
    expect(goingSentence([], 1)).toBe("1 is going");
    expect(goingSentence([], 0)).toBe("Be the first to register");
  });

  it("takes a first name", () => {
    expect(firstNameOf("  Grace Hopper ")).toBe("Grace");
    expect(firstNameOf("")).toBe("Someone");
  });
});
