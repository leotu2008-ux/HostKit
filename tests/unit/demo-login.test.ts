import { describe, expect, it } from "vitest";
import { PUBLIC_DEMO_PASSWORD, demoPassword } from "@/lib/demo-login";

describe("demoPassword", () => {
  it("keeps the public password locally and in CI, so the e2e specs can sign in", () => {
    expect(demoPassword({})).toBe(PUBLIC_DEMO_PASSWORD);
    expect(demoPassword({ CI: "true" })).toBe(PUBLIC_DEMO_PASSWORD);
  });

  it("never hands the public password to a hosted build, which seeds the production database", () => {
    expect(demoPassword({ VERCEL: "1" })).toBeNull();
    expect(demoPassword({ VERCEL: "1", VERCEL_ENV: "preview" })).toBeNull();
  });

  it("uses DEMO_PASSWORD when one is set", () => {
    expect(demoPassword({ VERCEL: "1", DEMO_PASSWORD: "a-long-private-one" })).toBe("a-long-private-one");
    expect(demoPassword({ DEMO_PASSWORD: "a-long-private-one" })).toBe("a-long-private-one");
  });

  it("ignores a DEMO_PASSWORD too short to sign in with, or the public one on a hosted build", () => {
    expect(demoPassword({ VERCEL: "1", DEMO_PASSWORD: "short" })).toBeNull();
    expect(demoPassword({ VERCEL: "1", DEMO_PASSWORD: PUBLIC_DEMO_PASSWORD })).toBeNull();
    expect(demoPassword({ DEMO_PASSWORD: "  " })).toBe(PUBLIC_DEMO_PASSWORD);
  });
});
