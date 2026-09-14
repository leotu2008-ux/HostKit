import { after } from "next/server";
import { apiUser, json } from "@/lib/api/http";
import { serializeSchool } from "@/lib/api/serialize";
import { campusEventsFor, campusSourcesInfo, serializeCampusEvent } from "@/lib/campus/feed";
import { fillIfEmpty, refreshIfStale } from "@/lib/campus/sync";
import { schoolFor } from "@/lib/schools";

/**
 * Everything on a school's official calendar for the next while, soonest
 * first: the viewer's school, or `?school=mit.edu`. A stale school is
 * refreshed after the response goes out.
 */
export async function GET(request: Request) {
  const viewer = await apiUser(request);
  const requested = new URL(request.url).searchParams.get("school");
  const school = schoolFor(requested || viewer?.schoolDomain);
  if (!school) {
    return json({ school: null, events: [], sources: [], syncedAt: null });
  }
  // First visitor to this campus: fill it before answering.
  await fillIfEmpty(school.domain);
  const [events, info] = await Promise.all([campusEventsFor(school.domain), campusSourcesInfo(school.domain)]);
  after(() => refreshIfStale(school.domain));
  return json({
    school: serializeSchool(school.domain),
    events: events.map(serializeCampusEvent),
    ...info,
  });
}
