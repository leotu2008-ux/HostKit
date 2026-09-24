import { describe, expect, it, vi } from "vitest";

// A cookie jar the drafts module reads and writes through next/headers.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

import { DRAFT_COOKIE, forgetDraftClaim, readDraftClaims, rememberDraftClaim } from "@/lib/drafts";
import { DRAFTS_HEADER, requestDrafts } from "@/lib/api/drafts";
import { MAYA_EMAIL, isMayaChen } from "@/lib/access";
import { PUBLIC_DEMO_PASSWORD, demoPassword } from "@/lib/demo-login";

const old = (claims: { id: string; token: string }[]) => jar.set("hostkit-drafts", JSON.stringify(claims));

describe("drafts survive the rename to Hosty", () => {
  it("keeps drafts under the Hosty cookie and header names", () => {
    expect(DRAFT_COOKIE).toBe("hosty-drafts");
    expect(DRAFTS_HEADER).toBe("x-hosty-drafts");
  });

  it("still reads drafts a browser saved under the old cookie", async () => {
    jar.clear();
    old([{ id: "e1", token: "ab" }]);
    expect(await readDraftClaims()).toEqual([{ id: "e1", token: "ab" }]);
  });

  it("moves old-cookie drafts to the new cookie on the next write, and drops the old one", async () => {
    jar.clear();
    old([{ id: "e1", token: "ab" }]);
    await rememberDraftClaim({ id: "e2", token: "cd" });
    expect(JSON.parse(jar.get("hosty-drafts")!)).toEqual([
      { id: "e2", token: "cd" },
      { id: "e1", token: "ab" },
    ]);
    expect(jar.has("hostkit-drafts")).toBe(false);
  });

  it("forgets a draft whichever cookie held it", async () => {
    jar.clear();
    old([{ id: "e1", token: "ab" }]);
    await forgetDraftClaim("e1");
    expect(await readDraftClaims()).toEqual([]);
  });

  it("accepts the old header the frozen iOS app still sends", () => {
    const request = new Request("https://tryhosty.app", { headers: { "X-HostKit-Drafts": "e1.ab" } });
    expect(requestDrafts(request)).toEqual([{ id: "e1", token: "ab" }]);
  });

  it("prefers the new header when both are sent", () => {
    const request = new Request("https://tryhosty.app", {
      headers: { "X-Hosty-Drafts": "e2.cd", "X-HostKit-Drafts": "e1.ab" },
    });
    expect(requestDrafts(request)).toEqual([{ id: "e2", token: "cd" }]);
  });
});

describe("the demo account after the rename", () => {
  it("is maya@hosty.demo, and a not-yet-reseeded old address still counts as her", () => {
    expect(MAYA_EMAIL).toBe("maya@hosty.demo");
    expect(isMayaChen({ email: "maya@hosty.demo", name: "Someone" })).toBe(true);
    expect(isMayaChen({ email: "maya@hostkit.demo", name: "Someone" })).toBe(true);
  });

  it("uses hosty-demo locally, and hosted builds refuse the old public password too", () => {
    expect(PUBLIC_DEMO_PASSWORD).toBe("hosty-demo");
    expect(demoPassword({})).toBe("hosty-demo");
    expect(demoPassword({ VERCEL: "1", DEMO_PASSWORD: "hostkit-demo" })).toBeNull();
    expect(demoPassword({ VERCEL: "1", DEMO_PASSWORD: "hosty-demo" })).toBeNull();
  });
});
