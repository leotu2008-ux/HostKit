import { after } from "next/server";
import { db } from "@/lib/db";
import { isCity } from "@/lib/catalog";
import { campusPreviewFor, campusSourcesInfo, serializeCampusEvent } from "@/lib/campus/feed";
import { refreshIfStale } from "@/lib/campus/sync";
import { apiUser, json } from "@/lib/api/http";
import { eventInclude, serializeClub, serializeEvent, serializeSchool } from "@/lib/api/serialize";
import { clubViewer } from "@/lib/api/clubs";
import { followingEvents, followingOfficialEvents, suggestedClubs } from "@/lib/clubs";
import { myUpcomingEvents } from "@/lib/mine";
import { upcomingOnly } from "@/lib/upcoming";
import { registrationStates } from "@/lib/registration";

const include = eventInclude;
const orderBy = [{ date: "asc" as const }, { createdAt: "desc" as const }];

/**
 * Upcoming public nights, optionally for one city. A signed-in viewer also
 * gets `mine` (what they host or are going to), `following` (from clubs they
 * follow) and a student gets `campus` (nights hosted by students there) and
 * `official` (the school's own calendar, see lib/campus); `clubs` are the
 * ones worth following at their school or in the city.
 */
export async function GET(request: Request) {
  const viewer = await apiUser(request);
  const rawCity = new URL(request.url).searchParams.get("city");
  const city = isCity(rawCity) ? rawCity : null;
  const live = { published: true as const, visibility: "PUBLIC" as const, ...upcomingOnly() };

  const [events, campus, mine, following, clubs, rel, official, officialInfo, followingOfficial] = await Promise.all([
    db.event.findMany({
      where: { ...live, ...(city ? { city } : {}) },
      orderBy,
      take: 50,
      include,
    }),
    viewer?.schoolDomain
      ? db.event.findMany({
          where: { ...live, schoolDomain: viewer.schoolDomain },
          orderBy,
          take: 20,
          include,
        })
      : Promise.resolve([]),
    viewer ? myUpcomingEvents(viewer.id, 12) : Promise.resolve([]),
    viewer ? followingEvents(viewer.id, 12) : Promise.resolve([]),
    suggestedClubs({ schoolDomain: viewer?.schoolDomain ?? null, city }, 12),
    clubViewer(viewer?.id ?? null),
    campusPreviewFor(viewer?.schoolDomain, 12),
    campusSourcesInfo(viewer?.schoolDomain),
    viewer ? followingOfficialEvents(viewer.id, 12) : Promise.resolve([]),
  ]);
  if (viewer?.schoolDomain) after(() => refreshIfStale(viewer.schoolDomain));

  const states = await registrationStates(
    [...events, ...campus, ...mine, ...following].map((e) => e.id),
    viewer?.id ?? null,
  );
  const out = (e: (typeof events)[number]) =>
    serializeEvent(
      e,
      e._count.guests,
      viewer !== null && (e.ownerId === viewer.id || (e.clubId !== null && rel.managed.has(e.clubId))),
      states.get(e.id) ?? "none",
    );
  return json({
    events: events.map(out),
    campus: campus.map(out),
    mine: mine.map(out),
    following: [...following.map(out), ...followingOfficial.map(serializeCampusEvent)].sort(
      (a, b) => (a.startsAt ?? "9").localeCompare(b.startsAt ?? "9"),
    ),
    clubs: clubs.map((c) => serializeClub(c, rel)),
    school: serializeSchool(viewer?.schoolDomain),
    official: official.map(serializeCampusEvent),
    officialSources: officialInfo.sources,
    officialSyncedAt: officialInfo.syncedAt,
  });
}
