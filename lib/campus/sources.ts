/**
 * Where each school's official events come from.
 *
 * Every school in lib/schools.ts can list one or more public feeds here.
 * `kind` picks the parser (lib/campus/parsers/*):
 *
 * - `localist`  — the Localist calendar platform's JSON API (`/api/2/events`)
 * - `ics`       — any iCalendar feed (Trumba, LiveWhale, home-grown)
 * - `bedework`  — Bedework's JSON "feeder" (Columbia)
 * - `campusgroups` — CampusGroups' `rss_events` (student orgs; Babson's "Belong")
 * - `cards`     — a plain HTML listing where each item has a `<time datetime>`
 *                 and a link (Wellesley, Olin)
 * - `babson`    — Babson's own events page (date boxes, no feed)
 *
 * Pure data, safe to import from client code. The sync (lib/campus/sync.ts)
 * fetches these on a schedule and whenever a student's feed looks stale.
 */

export type CampusSourceKind = "localist" | "ics" | "bedework" | "campusgroups" | "cards" | "babson";

export type CampusSource = {
  /** Stable id, stored on every event it produces: "<domain>/<slug>". */
  key: string;
  schoolDomain: string;
  /** How the feed is credited: "MIT Events Calendar". */
  name: string;
  /** Where a person would browse it. */
  homepage: string;
  /** What the sync fetches. */
  url: string;
  kind: CampusSourceKind;
  /** IANA zone the school's wall-clock times are in. */
  timeZone: string;
  /** For `cards`: the class name that marks one listing item. */
  itemClass?: string;
  /** For `cards`: how many `?page=N` pages to walk (default 1). */
  pages?: number;
  /** For `ics`: the feed writes local times with a "Z" suffix (BU does). */
  icsUtcIsLocal?: boolean;
};

const NY = "America/New_York";

export const CAMPUS_SOURCES: CampusSource[] = [
  {
    key: "babson.edu/belong",
    schoolDomain: "babson.edu",
    name: "Belong @ Babson",
    homepage: "https://belong.babson.edu/events",
    url: "https://belong.babson.edu/rss_events",
    kind: "campusgroups",
    timeZone: NY,
  },
  {
    key: "babson.edu/events",
    schoolDomain: "babson.edu",
    name: "Babson College Events",
    homepage: "https://www.babson.edu/about/events/",
    url: "https://www.babson.edu/about/events/?search=all",
    kind: "babson",
    timeZone: NY,
  },
  {
    key: "olin.edu/events",
    schoolDomain: "olin.edu",
    name: "Olin College Events",
    homepage: "https://www.olin.edu/events",
    url: "https://www.olin.edu/events",
    kind: "cards",
    timeZone: NY,
    itemClass: "oln__card--landing_page_event",
  },
  {
    key: "wellesley.edu/events",
    schoolDomain: "wellesley.edu",
    name: "Wellesley College Events",
    homepage: "https://www.wellesley.edu/events",
    url: "https://www.wellesley.edu/events",
    kind: "cards",
    timeZone: NY,
    itemClass: "event_list_row",
    pages: 4,
  },
  {
    key: "bu.edu/calendar",
    schoolDomain: "bu.edu",
    name: "BU University Calendar",
    homepage: "https://www.bu.edu/calendar/",
    url: "https://www.bu.edu/phpbin/calendar/ical.php",
    kind: "ics",
    timeZone: NY,
    icsUtcIsLocal: true,
  },
  {
    key: "bc.edu/events",
    schoolDomain: "bc.edu",
    name: "Boston College Events",
    homepage: "https://events.bc.edu/",
    url: "https://events.bc.edu/api/2/events",
    kind: "localist",
    timeZone: NY,
  },
  {
    key: "northeastern.edu/calendar",
    schoolDomain: "northeastern.edu",
    name: "Northeastern Events Calendar",
    homepage: "https://calendar.northeastern.edu/",
    url: "https://calendar.northeastern.edu/api/2/events",
    kind: "localist",
    timeZone: NY,
  },
  {
    key: "harvard.edu/gazette",
    schoolDomain: "harvard.edu",
    name: "Harvard Gazette Events",
    homepage: "https://news.harvard.edu/gazette/harvard-events/",
    url: "https://www.trumba.com/calendars/gazette.ics",
    kind: "ics",
    timeZone: NY,
  },
  {
    key: "mit.edu/calendar",
    schoolDomain: "mit.edu",
    name: "MIT Events Calendar",
    homepage: "https://calendar.mit.edu/",
    url: "https://calendar.mit.edu/api/2/events",
    kind: "localist",
    timeZone: NY,
  },
  {
    key: "tufts.edu/events",
    schoolDomain: "tufts.edu",
    name: "Tufts Events Calendar",
    homepage: "https://events.tufts.edu/",
    url: "https://www.trumba.com/calendars/tufts.ics",
    kind: "ics",
    timeZone: NY,
  },
  {
    key: "nyu.edu/events",
    schoolDomain: "nyu.edu",
    name: "NYU Events Calendar",
    homepage: "https://events.nyu.edu/",
    url: "https://events.nyu.edu/live/ical/events",
    kind: "ics",
    timeZone: NY,
  },
  {
    key: "columbia.edu/events",
    schoolDomain: "columbia.edu",
    name: "Columbia University Events",
    homepage: "https://events.columbia.edu/",
    url: "https://events.columbia.edu/feeder/main/eventsFeed.do?f=y&sort=dtstart.utc:asc&fexpr=(categories.href!=%22/public/.bedework/categories/sys/Ongoing%22)&skinName=list-json&count=300",
    kind: "bedework",
    timeZone: NY,
  },
  {
    key: "usc.edu/calendar",
    schoolDomain: "usc.edu",
    name: "USC Events Calendar",
    homepage: "https://calendar.usc.edu/",
    url: "https://calendar.usc.edu/api/2/events",
    kind: "localist",
    timeZone: "America/Los_Angeles",
  },
  {
    key: "utexas.edu/calendar",
    schoolDomain: "utexas.edu",
    name: "UT Austin Events Calendar",
    homepage: "https://calendar.utexas.edu/",
    url: "https://calendar.utexas.edu/api/2/events",
    kind: "localist",
    timeZone: "America/Chicago",
  },
  // ucla.edu: no campus-wide public feed found yet (happenings.ucla.edu was
  // retired); add one here when there is.
];

export function sourcesFor(schoolDomain: string | null | undefined): CampusSource[] {
  if (!schoolDomain) return [];
  return CAMPUS_SOURCES.filter((s) => s.schoolDomain === schoolDomain);
}

export function sourceByKey(key: string): CampusSource | null {
  return CAMPUS_SOURCES.find((s) => s.key === key) ?? null;
}

/** Schools that have at least one official feed. */
export const SCHOOLS_WITH_FEEDS = new Set(CAMPUS_SOURCES.map((s) => s.schoolDomain));
