import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BABSON_SCHOOL_DOMAIN,
  BELONG_SOURCE_KEY,
  externalIdFor,
  mapCampusJsonEvent,
  parseCampusJson,
  sameMappedEvent,
} from "@/lib/campus/json-import";

const belongUrl = "https://belong.babson.edu/BUF/rsvp?event_uid=0a43dd7e32b937f56dd3889c193c8cc4";
const collegeUrl = "https://www.babson.edu/parents-and-families/events/family-and-friends-weekend/";

describe("campus JSON import mapping", () => {
  it("uses the Belong source key and Babson school domain", () => {
    const mapped = mapCampusJsonEvent(
      {
        title: "Club Night",
        start: "2026-09-21T19:00:00-04:00",
        source_url: belongUrl,
        source_kind: "belong",
      },
      0,
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.row.sourceKey).toBe(BELONG_SOURCE_KEY);
    expect(mapped.row.schoolDomain).toBe(BABSON_SCHOOL_DOMAIN);
  });

  it("takes event_uid from the RSVP URL, else hashes the URL", () => {
    expect(externalIdFor(belongUrl)).toBe("0a43dd7e32b937f56dd3889c193c8cc4");
    expect(externalIdFor(collegeUrl)).toBe(createHash("sha256").update(collegeUrl).digest("hex"));
  });

  it("maps a Belong row onto CampusEvent fields, TBA → null, wall-clock times", () => {
    const mapped = mapCampusJsonEvent(
      {
        title: "Ultimate Frisbee Practice",
        host_club: "Babson Ultimate Frisbee",
        start: "2026-09-21T19:00:00-04:00",
        end: "2026-09-21T20:00:00-04:00",
        location: "TBA",
        description: "Join us for a relaxed session.",
        source_url: belongUrl,
        instagram: "",
        source_kind: "belong",
      },
      0,
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.row).toMatchObject({
      sourceKey: BELONG_SOURCE_KEY,
      schoolDomain: BABSON_SCHOOL_DOMAIN,
      externalId: "0a43dd7e32b937f56dd3889c193c8cc4",
      title: "Ultimate Frisbee Practice",
      description: "Join us for a relaxed session.",
      location: null,
      host: "Babson Ultimate Frisbee",
      url: belongUrl,
      restricted: false,
      allDay: false,
    });
    expect(mapped.row.startsAt.toISOString()).toBe("2026-09-21T19:00:00.000Z");
    expect(mapped.row.endsAt?.toISOString()).toBe("2026-09-21T20:00:00.000Z");
  });

  it("appends a non-empty Instagram line to the description", () => {
    const mapped = mapCampusJsonEvent(
      {
        title: "Club Night",
        start: "2026-09-21T19:00:00-04:00",
        source_url: belongUrl,
        description: "Come through.",
        instagram: "@babsonultimate",
        location: "Babson Hall 203",
      },
      0,
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.row.description).toBe("Come through.\n\nInstagram: @babsonultimate");
    expect(mapped.row.location).toBe("Babson Hall 203");
  });

  it("skips incomplete rows and duplicate ids; refuses a non-array", () => {
    const { rows, skipped } = parseCampusJson([
      { title: "A", start: "2026-09-21T19:00:00-04:00", source_url: belongUrl },
      { title: "dup", start: "2026-09-22T19:00:00-04:00", source_url: belongUrl },
      { title: "missing url", start: "2026-09-21T19:00:00-04:00" },
    ]);
    expect(rows).toHaveLength(1);
    expect(skipped.some((s) => /duplicate/.test(s))).toBe(true);
    expect(skipped.some((s) => /missing source_url/.test(s))).toBe(true);
    expect(() => parseCampusJson({ title: "nope" })).toThrow(/array of events/);
  });

  it("treats an identical stored row as unchanged", () => {
    const mapped = mapCampusJsonEvent(
      {
        title: "A",
        start: "2026-09-21T19:00:00-04:00",
        end: "2026-09-21T20:00:00-04:00",
        source_url: belongUrl,
        location: "TBA",
        host_club: "Club",
        description: "Hi",
      },
      0,
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(sameMappedEvent(mapped.row, mapped.row)).toBe(true);
    expect(sameMappedEvent({ ...mapped.row, title: "B" }, mapped.row)).toBe(false);
  });
});
