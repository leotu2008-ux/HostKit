import { describe, expect, it } from "vitest";
import { deviceMapsHref, mapsQuery, hasMapTarget } from "@/lib/maps";
import { isDiscoverable, isPublicPageVisible, safeNextPath } from "@/lib/listing";
import { claimMatches } from "@/lib/drafts";

describe("maps", () => {
  it("builds a geo link when coordinates are present", () => {
    const href = deviceMapsHref({
      lat: 40.72,
      lng: -73.96,
      address: "200 Kent Ave",
    });
    expect(href).toMatch(/^geo:40.72,-73.96/);
    expect(href).toContain("Kent");
  });

  it("falls back to a web maps search without coordinates", () => {
    expect(deviceMapsHref({ address: "Austin, TX" })).toContain(
      "maps.google.com",
    );
    expect(mapsQuery({ address: "Austin, TX" })).toBe("Austin, TX");
    expect(hasMapTarget({})).toBe(false);
  });
});

describe("listing visibility", () => {
  it("only lists public published nights on Discover", () => {
    expect(isDiscoverable({ published: true, visibility: "PUBLIC" })).toBe(true);
    expect(isDiscoverable({ published: true, visibility: "UNLISTED" })).toBe(
      false,
    );
    expect(isDiscoverable({ published: false, visibility: "PUBLIC" })).toBe(
      false,
    );
  });

  it("hides private nights from the public page", () => {
    expect(isPublicPageVisible({ published: true, visibility: "PRIVATE" })).toBe(
      false,
    );
    expect(
      isPublicPageVisible({ published: true, visibility: "UNLISTED" }),
    ).toBe(true);
  });

  it("rejects open-redirect next paths", () => {
    expect(safeNextPath("//evil.test")).toBe("/events");
    expect(safeNextPath("https://evil.test")).toBe("/events");
    expect(safeNextPath("/\\evil.test")).toBe("/events");
    expect(safeNextPath("/events\r\nSet-Cookie: x")).toBe("/events");
    expect(safeNextPath("/events/abc")).toBe("/events/abc");
  });
});

describe("draft claims", () => {
  it("matches a cookie claim to an event token", () => {
    expect(
      claimMatches([{ id: "e1", token: "abc" }], "e1", "abc"),
    ).toBe(true);
    expect(
      claimMatches([{ id: "e1", token: "abc" }], "e1", "nope"),
    ).toBe(false);
  });
});
