import { parseOffsetIso } from "@/lib/campus/time";
import { htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/**
 * Anthology Engage (`<school>.campuslabs.com/engage`): the student-org
 * platform at BC, NYU, Purdue, Berkeley and many more. Its discovery API is
 * public JSON; every event names the organisation behind it, which is what
 * makes real clubs possible (lib/campus/sync.ts).
 */

export type EngageEvent = {
  id: string | number;
  name: string;
  description?: string | null;
  startsOn: string;
  endsOn?: string | null;
  location?: string | null;
  organizationName?: string | null;
  organizationId?: number | string | null;
  organizationProfilePicture?: string | null;
  imagePath?: string | null;
  status?: string | null;
  visibility?: string | null;
  theme?: string | null;
};
export type EngagePage = { value?: EngageEvent[]; "@odata.count"?: number };

const IMAGES = "https://se-images.campuslabs.com/clink/images/";

export function parseEngage(page: EngagePage, opts: { timeZone: string; pageUrl: string }): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  // pageUrl is ".../engage/events"; an event lives at ".../engage/event/<id>".
  const eventBase = opts.pageUrl.replace(/\/events\/?$/, "/event/");
  for (const e of page.value ?? []) {
    if (!e?.id || !e.name) continue;
    if (e.status && e.status !== "Approved") continue;
    if (e.visibility && e.visibility !== "Public") continue;
    const startsAt = parseOffsetIso(e.startsOn, opts.timeZone);
    if (!startsAt) continue;
    const endsAt = e.endsOn ? parseOffsetIso(e.endsOn, opts.timeZone) : null;
    const image = e.imagePath ? `${IMAGES}${e.imagePath}?preset=med-w` : null;
    out.push({
      externalId: String(e.id),
      title: oneLine(e.name, 160) ?? "Untitled",
      description: htmlToText(e.description),
      startsAt,
      endsAt,
      allDay: false,
      location: oneLine(e.location),
      url: `${eventBase}${e.id}`,
      imageUrl: image,
      host: oneLine(e.organizationName, 120),
      hostId: e.organizationId != null && e.organizationName ? String(e.organizationId) : null,
      hostKind: "Student Organization",
    });
  }
  return out;
}
