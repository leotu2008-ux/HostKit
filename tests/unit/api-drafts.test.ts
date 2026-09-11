import { describe, expect, it } from "vitest";
import { parseDraftsHeader } from "@/lib/api/drafts";

describe("parseDraftsHeader", () => {
  it("reads id.token pairs", () => {
    expect(parseDraftsHeader("abc.0f1e, def.2a3b")).toEqual([
      { id: "abc", token: "0f1e" },
      { id: "def", token: "2a3b" },
    ]);
  });

  it("drops malformed entries without giving up on the rest", () => {
    expect(parseDraftsHeader("nodot,.tok,id.,ok.1")).toEqual([
      { id: "ok", token: "1" },
    ]);
  });

  it("handles a missing header", () => {
    expect(parseDraftsHeader(null)).toEqual([]);
    expect(parseDraftsHeader("")).toEqual([]);
  });

  it("caps the list at 20", () => {
    const raw = Array.from({ length: 30 }, (_, i) => `id${i}.t`).join(",");
    expect(parseDraftsHeader(raw)).toHaveLength(20);
  });
});
