import { db } from "@/lib/db";
import { isCity } from "@/lib/catalog";
import { apiUser, json } from "@/lib/api/http";
import { goingCount, serializeEvent, serializeSchool } from "@/lib/api/serialize";
import { upcomingOnly } from "@/lib/upcoming";

const include = { owner: { select: { name: true } }, ...goingCount };
const orderBy = [{ date: "asc" as const }, { createdAt: "desc" as const }];

/**
 * Upcoming public nights, optionally for one city. A signed-in student also
 * gets `campus`: their school's nights first, wherever they are.
 */
export async function GET(request: Request) {
  const viewer = await apiUser(request);
  const rawCity = new URL(request.url).searchParams.get("city");
  const city = isCity(rawCity) ? rawCity : null;
  const live = { published: true as const, visibility: "PUBLIC" as const, ...upcomingOnly() };

  const [events, campus] = await Promise.all([
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
  ]);

  const canManage = (ownerId: string | null) => viewer !== null && ownerId === viewer.id;
  return json({
    events: events.map((e) => serializeEvent(e, e._count.guests, canManage(e.ownerId))),
    campus: campus.map((e) => serializeEvent(e, e._count.guests, canManage(e.ownerId))),
    school: serializeSchool(viewer?.schoolDomain),
  });
}
