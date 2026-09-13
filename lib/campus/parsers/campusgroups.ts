import { parseOffsetIso, localDate } from "@/lib/campus/time";
import { decodeEntities, htmlToText, oneLine } from "@/lib/campus/text";
import type { ParsedEvent } from "@/lib/campus/parsers/types";

/**
 * CampusGroups' `rss_events` feed — the student-org calendar behind
 * "Belong" at Babson and many other campuses. Plain XML tags, one <item> per
 * event, with ISO start/end (offset included), the hosting group, a photo
 * and a privacy level (0 = public; anything else needs a school login).
 */

function tag(item: string, name: string): string | null {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  if (!m) return null;
  const raw = m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
  return raw ? decodeEntities(raw) : null;
}

export function parseCampusGroups(xml: string, opts: { timeZone: string; pageUrl: string }): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const item of xml.split("<item>").slice(1)) {
    const id = tag(item, "eventId");
    const title = oneLine(tag(item, "title"), 160);
    if (!id || !title) continue;
    if ((tag(item, "approvalStatus") ?? "1") !== "1") continue;
    // Non-zero privacy is "the school community": the feed still gives the
    // title and time, and hides the place until you sign in there. A student
    // knows these nights, so they're listed with that note — not dropped.
    const restricted = (tag(item, "privacyLevel") ?? "0") !== "0";

    const allDay = tag(item, "allDayEvent") === "1";
    const startIso = tag(item, "eventStartDateTime");
    const endIso = tag(item, "eventEndDateTime");
    let startsAt = startIso ? parseOffsetIso(startIso, opts.timeZone) : null;
    if (!startsAt) {
      // Fall back to the M/D/YYYY date when the ISO field is missing.
      const d = tag(item, "eventDate")?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!d) continue;
      startsAt = localDate(+d[3], +d[1], +d[2]);
    }
    const endsAt = endIso ? parseOffsetIso(endIso, opts.timeZone) : null;

    const location = oneLine(tag(item, "eventLocation"));
    const group = oneLine(tag(item, "group"), 120);
    const photo = tag(item, "eventPhotoFullUrl") ?? tag(item, "eventOriginalPhotoFullUrl");
    out.push({
      externalId: id,
      title,
      description: htmlToText(tag(item, "fullDescription") ?? tag(item, "description")),
      startsAt,
      endsAt,
      allDay,
      location: location && !/sign in to display/i.test(location) ? location : null,
      url: tag(item, "eventLink") ?? tag(item, "link") ?? opts.pageUrl,
      imageUrl: photo && /^https?:\/\//.test(photo) ? photo : null,
      host: group,
      restricted,
    });
  }
  return out;
}
