import { db } from "@/lib/db";
import { isCity } from "@/lib/catalog";
import { apiUser, json } from "@/lib/api/http";
import { goingCount, serializeEvent, serializeSchool } from "@/lib/api/serialize";
import { myUpcomingEvents } from "@/lib/mine";
import { upcomingOnly } from "@/lib/upcoming";
import { registrationStates } from "@/lib/registration";

const include = { owner: { select: { name: true } }, ...goingCount };
const orderBy = [{ date: "asc" as const }, { createdAt: "desc" as const }];

/**
 * Upcoming public nights, optionally for one city. A signed-in viewer also
 * gets `mine` (what they host or are going to, soonest first) and a student
 * gets `campus`: their school's nights first, wherever they are.
 */
export async function GET(request: Request) {
  const viewer = await apiUser(request);
  const rawCity = new URL(request.url).searchParams.get("city");
  const city = isCity(rawCity) ? rawCity : null;
  const live = { published: true as const, visibility: "PUBLIC" as const, ...upcomingOnly() };

  const [events, campus, mine] = await Promise.all([
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
  ]);

  const states = await registrationStates(
    [...events, ...campus, ...mine].map((e) => e.id),
    viewer?.id ?? null,
  );
  const out = (e: (typeof events)[number]) =>
    serializeEvent(
      e,
      e._count.guests,
      viewer !== null && e.ownerId === viewer.id,
      states.get(e.id) ?? "none",
    );
  return json({
    events: events.map(out),
    campus: campus.map(out),
    mine: mine.map(out),
    school: serializeSchool(viewer?.schoolDomain),
  });
}
