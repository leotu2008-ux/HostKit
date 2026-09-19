import { createHash } from "node:crypto";
import { sourceByKey } from "@/lib/campus/sources";
import { parseOffsetIso } from "@/lib/campus/time";
import { htmlToText, oneLine } from "@/lib/campus/text";

/**
 * Maps a JSON dump of Babson Belong club events onto CampusEvent rows.
 * The live sync (lib/campus/sync.ts) still owns the RSS feed; this is the
 * shape a one-off `scripts/import-campus-json.ts` run writes.
 */

export const BELONG_SOURCE_KEY = "babson.edu/belong";
export const BABSON_SCHOOL_DOMAIN = "babson.edu";

export type CampusJsonEvent = {
  title?: unknown;
  host_club?: unknown;
  start?: unknown;
  end?: unknown;
  location?: unknown;
  description?: unknown;
  source_url?: unknown;
  instagram?: unknown;
  source_kind?: unknown;
};

export type MappedCampusEvent = {
  sourceKey: string;
  schoolDomain: string;
  externalId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  location: string | null;
  restricted: boolean;
  host: string | null;
  url: string;
};

export type MapResult =
  | { ok: true; row: MappedCampusEvent }
  | { ok: false; error: string };

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** `event_uid` on the Belong RSVP URL, else a stable hash of the URL itself. */
export function externalIdFor(sourceUrl: string): string {
  try {
    const uid = new URL(sourceUrl).searchParams.get("event_uid")?.trim();
    if (uid) return uid;
  } catch {
    // Fall through to the hash: a malformed URL is still a stable identity.
  }
  return createHash("sha256").update(sourceUrl).digest("hex");
}

function locationFor(raw: string): string | null {
  const location = oneLine(raw);
  if (!location || /^tba$/i.test(location)) return null;
  return location;
}

function descriptionFor(description: string, instagram: string): string | null {
  const body = htmlToText(description);
  const handle = asString(instagram);
  if (!handle) return body;
  const line = `Instagram: ${handle}`;
  return body ? `${body}\n\n${line}` : line;
}

function timeZoneFor(sourceKey: string): string {
  return sourceByKey(sourceKey)?.timeZone ?? "America/New_York";
}

export function mapCampusJsonEvent(raw: CampusJsonEvent, index: number): MapResult {
  const title = oneLine(asString(raw.title), 160);
  const url = asString(raw.source_url);
  const start = asString(raw.start);
  if (!title) return { ok: false, error: `row ${index}: missing title` };
  if (!url) return { ok: false, error: `row ${index}: missing source_url` };
  if (!start) return { ok: false, error: `row ${index}: missing start` };

  // Dump rows are Belong club events (`source_kind=belong`); a few
  // babson.edu pages ride along. One sourceKey so the upsert set is one feed.
  const sourceKey = BELONG_SOURCE_KEY;
  const zone = timeZoneFor(sourceKey);
  const startsAt = parseOffsetIso(start, zone);
  if (!startsAt) return { ok: false, error: `row ${index}: invalid start` };

  const end = asString(raw.end);
  const endsAt = end ? parseOffsetIso(end, zone) : null;
  if (end && !endsAt) return { ok: false, error: `row ${index}: invalid end` };

  return {
    ok: true,
    row: {
      sourceKey,
      schoolDomain: BABSON_SCHOOL_DOMAIN,
      externalId: externalIdFor(url),
      title,
      description: descriptionFor(asString(raw.description), asString(raw.instagram)),
      startsAt,
      endsAt,
      allDay: false,
      location: locationFor(asString(raw.location)),
      restricted: false,
      host: oneLine(asString(raw.host_club), 120),
      url,
    },
  };
}

export function parseCampusJson(payload: unknown): { rows: MappedCampusEvent[]; skipped: string[] } {
  if (!Array.isArray(payload)) {
    throw new Error("JSON root must be an array of events.");
  }
  const rows: MappedCampusEvent[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  payload.forEach((item, i) => {
    const raw = item && typeof item === "object" ? (item as CampusJsonEvent) : {};
    const mapped = mapCampusJsonEvent(raw, i);
    if (!mapped.ok) {
      skipped.push(mapped.error);
      return;
    }
    const key = `${mapped.row.sourceKey}:${mapped.row.externalId}`;
    if (seen.has(key)) {
      skipped.push(`row ${i}: duplicate ${mapped.row.externalId}`);
      return;
    }
    seen.add(key);
    rows.push(mapped.row);
  });
  return { rows, skipped };
}

/** True when a stored row already matches what this import would write. */
export function sameMappedEvent(
  stored: {
    title: string;
    description: string | null;
    startsAt: Date;
    endsAt: Date | null;
    allDay: boolean;
    location: string | null;
    restricted: boolean;
    host: string | null;
    url: string;
    schoolDomain: string;
  },
  next: MappedCampusEvent,
): boolean {
  return (
    stored.schoolDomain === next.schoolDomain &&
    stored.title === next.title &&
    stored.description === next.description &&
    stored.startsAt.getTime() === next.startsAt.getTime() &&
    (stored.endsAt?.getTime() ?? null) === (next.endsAt?.getTime() ?? null) &&
    stored.allDay === next.allDay &&
    stored.location === next.location &&
    stored.restricted === next.restricted &&
    stored.host === next.host &&
    stored.url === next.url
  );
}
