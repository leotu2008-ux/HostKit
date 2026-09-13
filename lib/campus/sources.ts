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
 * - `rss`       — RSS where each item's pubDate is the event start (Princeton)
 * - `cards`     — a plain HTML listing: each item's `<time datetime>`, or a
 *                 month/day date box, or a "September 11, 2026, 8:30 p.m."
 *                 in its text, plus a link (Wellesley, Olin, Dartmouth, Rutgers)
 * - `babson`    — Babson's own events page (date boxes, no feed)
 *
 * Pure data, safe to import from client code. The sync (lib/campus/sync.ts)
 * fetches these on a schedule and whenever a student's feed looks stale.
 */

export type CampusSourceKind = "localist" | "ics" | "bedework" | "campusgroups" | "rss" | "cards" | "babson";

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
  /** For `cards` with no `<time>`: class names of the month, day, year and time text. */
  dateBox?: { month: string; day: string; year?: string; time?: string };
  /** For `ics`: the feed writes local times with a "Z" suffix (BU does). */
  icsUtcIsLocal?: boolean;
  /** Keep only events whose place matches this (a regex): home games, say. */
  only?: { location: string };
  /** Drop what this regex matches from every title ("[W] Babson College " on scores). */
  titleStrip?: string;
};

const NY = "America/New_York";
const CHI = "America/Chicago";
const LA = "America/Los_Angeles";

/** A Localist calendar: `<base>/api/2/events`. */
function localist(domain: string, name: string, base: string, timeZone: string): CampusSource {
  return { key: `${domain}/localist`, schoolDomain: domain, name, homepage: `${base}/`, url: `${base}/api/2/events`, kind: "localist", timeZone };
}

/** A LiveWhale calendar: `<base>/live/ical/events`. */
function livewhale(domain: string, name: string, base: string, timeZone: string): CampusSource {
  return { key: `${domain}/livewhale`, schoolDomain: domain, name, homepage: `${base}/`, url: `${base}/live/ical/events`, kind: "ics", timeZone };
}

/** A Trumba-published calendar by its web name. */
function trumba(domain: string, name: string, homepage: string, webName: string, timeZone: string): CampusSource {
  return { key: `${domain}/trumba`, schoolDomain: domain, name, homepage, url: `https://www.trumba.com/calendars/${webName}.ics`, kind: "ics", timeZone };
}

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
    // Sidearm's public iCalendar: every game, home and away. Home games only —
    // the ones at Babson Park — since those are the nights on campus.
    key: "babson.edu/athletics",
    schoolDomain: "babson.edu",
    name: "Babson Athletics",
    homepage: "https://babsonathletics.com/calendar",
    url: "https://babsonathletics.com/calendar.ashx/calendar.ics",
    kind: "ics",
    timeZone: NY,
    only: { location: "Babson Park" },
    // Played games get a "[W]" / "[L]" result tag in front.
    titleStrip: "^(\\[[A-Z]\\]\\s*)?Babson College\\s+",
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
  // ---- U.S. News top 50 (2026) and friends. Verified 2026-09-12. ----
  {
    key: "princeton.edu/events",
    schoolDomain: "princeton.edu",
    name: "Princeton Events",
    homepage: "https://www.princeton.edu/events",
    url: "https://www.princeton.edu/feed/events/",
    kind: "rss",
    timeZone: NY,
  },
  localist("stanford.edu", "Stanford Events", "https://events.stanford.edu", LA),
  localist("yale.edu", "Yale Events", "https://events.yale.edu", NY),
  {
    key: "duke.edu/calendar",
    schoolDomain: "duke.edu",
    name: "Duke Events Calendar",
    homepage: "https://calendar.duke.edu/",
    url: "https://calendar.duke.edu/events/index.ics?future_days=60",
    kind: "ics",
    timeZone: NY,
  },
  localist("cornell.edu", "Cornell Events", "https://events.cornell.edu", NY),
  livewhale("uchicago.edu", "UChicago Events", "https://events.uchicago.edu", CHI),
  livewhale("brown.edu", "Events@Brown", "https://events.brown.edu", NY),
  {
    key: "dartmouth.edu/events",
    schoolDomain: "dartmouth.edu",
    name: "Dartmouth Events",
    homepage: "https://home.dartmouth.edu/events",
    url: "https://home.dartmouth.edu/events",
    kind: "cards",
    timeZone: NY,
    itemClass: "event-teaser",
    dateBox: { month: "event-teaser__date-month", day: "event-teaser__date-day", time: "event-teaser__time" },
  },
  livewhale("berkeley.edu", "Berkeley Events", "https://events.berkeley.edu", LA),
  livewhale("rice.edu", "Rice Events", "https://events.rice.edu", CHI),
  {
    key: "nd.edu/events",
    schoolDomain: "nd.edu",
    name: "Notre Dame Events",
    homepage: "https://events.nd.edu/",
    url: "https://events.nd.edu/events.ics",
    kind: "ics",
    timeZone: NY,
  },
  livewhale("vanderbilt.edu", "Vanderbilt Events", "https://events.vanderbilt.edu", CHI),
  livewhale("cmu.edu", "CMU Events", "https://events.cmu.edu", NY),
  localist("wustl.edu", "WashU Happenings", "https://happenings.washu.edu", CHI),
  livewhale("georgetown.edu", "Georgetown Events", "https://events.georgetown.edu", NY),
  trumba("virginia.edu", "UVA Events", "https://www.virginia.edu/calendar/", "university-of-virginia-events", NY),
  localist("unc.edu", "UNC Events", "https://calendar.unc.edu", NY),
  localist("ucsd.edu", "UC San Diego Events", "https://calendar.ucsd.edu", LA),
  livewhale("ufl.edu", "UF Calendar", "https://calendar.ufl.edu", NY),
  {
    key: "wisc.edu/today",
    schoolDomain: "wisc.edu",
    name: "UW–Madison Events",
    homepage: "https://today.wisc.edu/events",
    url: "https://today.wisc.edu/events.ics",
    kind: "ics",
    timeZone: CHI,
  },
  {
    key: "rutgers.edu/events",
    schoolDomain: "rutgers.edu",
    name: "Rutgers Events",
    homepage: "https://www.rutgers.edu/events",
    url: "https://www.rutgers.edu/events",
    kind: "cards",
    timeZone: NY,
    itemClass: "c--event-card",
  },
  trumba("washington.edu", "UW Events Calendar", "https://www.washington.edu/calendar/", "sea_campus", LA),
  localist("purdue.edu", "Purdue Events", "https://events.purdue.edu", NY),
  livewhale("tamu.edu", "Texas A&M Events", "https://calendar.tamu.edu", CHI),
  localist("uga.edu", "UGA Master Calendar", "https://calendar.uga.edu", NY),
  localist("rochester.edu", "Rochester Events", "https://events.rochester.edu", NY),
  localist("wfu.edu", "Wake Forest Events", "https://events.wfu.edu", NY),
  livewhale("umn.edu", "UMN Events", "https://events.tc.umn.edu", CHI),
  localist("fsu.edu", "FSU Calendar", "https://calendar.fsu.edu", NY),
  trumba("brandeis.edu", "Brandeis Events", "https://www.brandeis.edu/events/", "brandeis-university", NY),
  // No public campus-wide feed found (2026-09-12): caltech.edu, jhu.edu,
  // northwestern.edu (PlanIt Purple exports need a login), upenn.edu and
  // umich.edu (bot-walled), emory.edu, gatech.edu (per-category RSS only),
  // ucdavis.edu, uci.edu, illinois.edu, ucsb.edu, osu.edu, umd.edu,
  // lehigh.edu, ucla.edu. Add a line here when one turns up.
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
