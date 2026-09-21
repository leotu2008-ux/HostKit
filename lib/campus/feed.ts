import { db } from "@/lib/db";
import type { ApiEvent } from "@/lib/api/serialize";
import { serializeSchool } from "@/lib/api/serialize";
import { schoolFor } from "@/lib/schools";
import { sourceByKey, sourcesFor } from "@/lib/campus/sources";
import { durationHours } from "@/lib/campus/time";
import { lastSyncedAt } from "@/lib/campus/sync";
import { collapseSeries, type Series } from "@/lib/campus/series";

/**
 * Reading official campus events for the feeds. They're served in the same
 * `ApiEvent` shape as hosted events so both apps list them with the cards
 * they already have; `official` says which feed it came from and where the
 * real page is, and `id` carries a `campus_` prefix so nothing tries to
 * register for one.
 */

export const CAMPUS_ID_PREFIX = "campus_";

export function isCampusId(id: string): boolean {
  return id.startsWith(CAMPUS_ID_PREFIX);
}

export type CampusEventRow = {
  id: string;
  schoolDomain: string;
  sourceKey: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  location: string | null;
  restricted: boolean;
  host: string | null;
  url: string;
  imageUrl: string | null;
};

/** A feed row as the previews show it: one per series, with the rest folded in. */
export type CampusPreviewRow = CampusEventRow & { repeats: Series | null };

/**
 * The short "At [School]" lists: recurring listings folded to one row each
 * (see lib/campus/series.ts), soonest first, `take` rows. Reads well past
 * `take` so a campus that lists open play every day still has room for the
 * rest.
 */
export async function campusPreviewFor(
  schoolDomain: string | null | undefined,
  take: number,
  q: string | null = null,
): Promise<CampusPreviewRow[]> {
  const rows = await campusEventsFor(schoolDomain, Math.max(take * 10, 120), q);
  return collapseSeries(rows).slice(0, take);
}

/**
 * Two feeds often carry the same night: a club posts it on the student-org
 * platform and the school repeats it on its own calendar, under the same
 * name on the same day. Keeping both made the campus list read like a
 * stutter. One row survives per title-and-day — whichever of them says more,
 * since the two rarely carry the same photo, place and host.
 */
export function dedupeAcrossSources<T extends CampusEventRow>(rows: T[]): T[] {
  const said = (row: T) =>
    [row.imageUrl, row.location, row.host, row.description].filter(Boolean).length;
  // Keyed on the exact start, not the day. Every cross-source duplicate we
  // see shares a start to the minute, while a title repeated at two times in
  // one day — "Wellness Through Mattering" at 4pm and again at 7pm — is two
  // sessions someone might attend, and merging those loses a real event.
  const key = (row: T) =>
    `${row.startsAt.toISOString()}|${row.title.toLowerCase().replace(/\s+/g, " ").trim()}`;

  const best = new Map<string, T>();
  const order: string[] = [];
  for (const row of rows) {
    const k = key(row);
    const seen = best.get(k);
    if (!seen) {
      best.set(k, row);
      order.push(k);
    } else if (said(row) > said(seen)) {
      best.set(k, row);
    }
  }
  return order.map((k) => best.get(k)!);
}

/** Upcoming official events for a school, soonest first; `q` matches the title, host or place. */
export async function campusEventsFor(
  schoolDomain: string | null | undefined,
  take = 200,
  q: string | null = null,
): Promise<CampusEventRow[]> {
  if (!schoolDomain) return [];
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const search = q?.trim()
    ? {
        OR: [
          { title: { contains: q.trim(), mode: "insensitive" as const } },
          { host: { contains: q.trim(), mode: "insensitive" as const } },
          { location: { contains: q.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};
  const rows = await db.campusEvent.findMany({
    where: { schoolDomain, startsAt: { gte: today }, ...search },
    orderBy: [{ startsAt: "asc" }, { title: "asc" }],
    take,
  });
  return dedupeAcrossSources(rows);
}

export async function campusEventById(id: string): Promise<CampusEventRow | null> {
  const raw = id.startsWith(CAMPUS_ID_PREFIX) ? id.slice(CAMPUS_ID_PREFIX.length) : id;
  return db.campusEvent.findUnique({ where: { id: raw } });
}

/** The feeds behind a school's official events, for crediting them. */
export async function campusSourcesInfo(schoolDomain: string | null | undefined) {
  const sources = sourcesFor(schoolDomain);
  const syncedAt = sources.length ? await lastSyncedAt(schoolDomain!) : null;
  return {
    sources: sources.map((s) => ({ key: s.key, name: s.name, url: s.homepage })),
    syncedAt: syncedAt ? syncedAt.toISOString() : null,
  };
}

export function serializeCampusEvent(row: CampusEventRow & { repeats?: Series | null }): ApiEvent {
  const school = schoolFor(row.schoolDomain);
  const source = sourceByKey(row.sourceKey);
  return {
    id: `${CAMPUS_ID_PREFIX}${row.id}`,
    title: row.title,
    // A valid type keeps older clients decoding; the label is what shows.
    type: "DINNER_PARTY",
    typeLabel: "Official event",
    // Not a HostKit brief — the school's calendar is already the finished fact.
    kind: null,
    description: row.description,
    city: school?.city ?? "",
    address: row.location,
    lat: null,
    lng: null,
    startsAt: row.startsAt.toISOString(),
    durationHours: durationHours(row.startsAt, row.endsAt),
    capacity: 0,
    going: 0,
    ticketType: "FREE",
    ticketPriceCents: 0,
    visibility: "PUBLIC",
    published: true,
    hostName: row.host ?? source?.name ?? school?.name ?? null,
    school: serializeSchool(row.schoolDomain),
    isOwner: false,
    registered: false,
    registration: "none",
    requiresApproval: false,
    attendees: [],
    club: null,
    coverUrl: row.imageUrl,
    briefComplete: true,
    webPath: `/campus/${row.id}`,
    official: {
      source: source?.name ?? school?.name ?? "Official calendar",
      url: row.url,
      allDay: row.allDay,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      restricted: row.restricted,
      repeats: row.repeats ?? null,
    },
  };
}
