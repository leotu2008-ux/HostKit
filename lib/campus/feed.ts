import { db } from "@/lib/db";
import type { ApiEvent } from "@/lib/api/serialize";
import { serializeSchool } from "@/lib/api/serialize";
import { schoolFor } from "@/lib/schools";
import { sourceByKey, sourcesFor } from "@/lib/campus/sources";
import { durationHours } from "@/lib/campus/time";
import { lastSyncedAt } from "@/lib/campus/sync";

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
  host: string | null;
  url: string;
  imageUrl: string | null;
};

/** Upcoming official events for a school, soonest first. */
export async function campusEventsFor(schoolDomain: string | null | undefined, take = 200): Promise<CampusEventRow[]> {
  if (!schoolDomain) return [];
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return db.campusEvent.findMany({
    where: { schoolDomain, startsAt: { gte: today } },
    orderBy: [{ startsAt: "asc" }, { title: "asc" }],
    take,
  });
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

export function serializeCampusEvent(row: CampusEventRow): ApiEvent {
  const school = schoolFor(row.schoolDomain);
  const source = sourceByKey(row.sourceKey);
  return {
    id: `${CAMPUS_ID_PREFIX}${row.id}`,
    title: row.title,
    // A valid type keeps older clients decoding; the label is what shows.
    type: "DINNER_PARTY",
    typeLabel: "Official event",
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
    webPath: `/campus/${row.id}`,
    official: {
      source: source?.name ?? school?.name ?? "Official calendar",
      url: row.url,
      allDay: row.allDay,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    },
  };
}
