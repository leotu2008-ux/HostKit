import { describe, expect, it } from "vitest";
import { schoolDomainFor, schoolFor, schoolForEmail } from "@/lib/schools";
import { nearestCity } from "@/lib/catalog";

describe("schoolDomainFor", () => {
  it("reads the domain from a .edu address", () => {
    expect(schoolDomainFor("sam@babson.edu")).toBe("babson.edu");
    expect(schoolDomainFor("  Sam@Babson.EDU ")).toBe("babson.edu");
  });

  it("collapses mail subdomains onto the school", () => {
    expect(schoolDomainFor("sam@mail.babson.edu")).toBe("babson.edu");
  });

  it("is null for anything that isn't .edu", () => {
    expect(schoolDomainFor("sam@gmail.com")).toBeNull();
    expect(schoolDomainFor("sam@edu.example.com")).toBeNull();
    expect(schoolDomainFor("not-an-email")).toBeNull();
  });
});

describe("schoolFor", () => {
  it("knows Babson and its home city", () => {
    expect(schoolForEmail("sam@babson.edu")).toMatchObject({
      name: "Babson College",
      short: "Babson",
      city: "Boston, MA",
    });
  });

  it("still counts an unknown .edu as a student", () => {
    expect(schoolFor("stateu.edu")).toEqual({
      domain: "stateu.edu",
      name: "Stateu",
      short: "Stateu",
      city: null,
    });
  });

  it("is null without a domain", () => {
    expect(schoolFor(null)).toBeNull();
    expect(schoolFor("gmail.com")).toBeNull();
  });
});

describe("nearestCity", () => {
  it("puts Wellesley in Boston", () => {
    expect(nearestCity(42.2966, -71.2924)).toBe("Boston, MA");
  });

  it("puts Brooklyn in New York", () => {
    expect(nearestCity(40.6782, -73.9442)).toBe("New York, NY");
  });

  it("gives up somewhere Hosty doesn't cover", () => {
    // Chicago
    expect(nearestCity(41.8781, -87.6298)).toBeNull();
  });
});
