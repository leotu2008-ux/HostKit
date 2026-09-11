import { db } from "@/lib/db";
import { CITIES } from "@/lib/catalog";
import { apiUser, json } from "@/lib/api/http";
import { goingCount, serializeEvent } from "@/lib/api/serialize";
import { upcomingOnly } from "@/lib/upcoming";

/** Upcoming public nights, optionally for one city. */
export async function GET(request: Request) {
  const viewer = await apiUser(request);
  const city = new URL(request.url).searchParams.get("city");
  const knownCity = (CITIES as readonly string[]).includes(city ?? "")
    ? city
    : null;

  const events = await db.event.findMany({
    where: {
      published: true,
      visibility: "PUBLIC",
      ...(knownCity ? { city: knownCity } : {}),
      ...upcomingOnly(),
    },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    take: 50,
    include: { owner: { select: { name: true } }, ...goingCount },
  });

  return json({
    events: events.map((event) =>
      serializeEvent(event, event._count.guests, viewer?.id ?? null),
    ),
  });
}
