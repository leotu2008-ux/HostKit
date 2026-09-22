/**
 * Picks a glyph for an event that has no photo.
 *
 * About a quarter of synced campus events arrive without an image, so the
 * placeholder is not an edge case — it is what thousands of cards look like.
 * A gradient alone says nothing; a glyph makes a wall of cards scannable at
 * the speed people actually read them.
 *
 * The categories below were derived from real titles in the synced feed, not
 * invented: athletics fixtures and general body meetings dominate, then
 * seminars, tutoring, worship, fitness, exhibitions and food.
 *
 * Pure and dependency-free, so it is cheap to test and safe on the client.
 */

export type EventIcon =
  | "athletics"
  | "meeting"
  | "talk"
  | "study"
  | "worship"
  | "fitness"
  | "arts"
  | "stage"
  | "food"
  | "outdoors"
  | "deadline"
  | "career"
  | "giving"
  | "celebration"
  | "calendar";

/** The fallback, when nothing in the title gives anything away. */
export const DEFAULT_ICON: EventIcon = "calendar";

/** Hosty's own events carry a type, which beats guessing from words. */
const BY_EVENT_TYPE: Record<string, EventIcon> = {
  BIRTHDAY: "celebration",
  LAUNCH_PARTY: "celebration",
  DINNER_PARTY: "food",
  CORPORATE_OFFSITE: "career",
  FUNDRAISER: "giving",
  MIXER: "celebration",
  FORMAL: "celebration",
  GENERAL_MEETING: "meeting",
  PITCH_NIGHT: "talk",
  STUDY_BREAK: "study",
};

const SPORTS =
  /\b(soccer|basketball|hockey|tennis|wrestling|swimming|diving|lacrosse|volleyball|baseball|softball|football|cross country|track and field|rowing|crew|squash|fencing|water polo|rugby|golf|gymnastics|athletics|intramurals?|dodgeball|frisbee|pickleball|badminton|cricket)\b/;

const CONTESTS = /\b(tournaments?|tryouts?|scrimmages?|invitationals?|championships?|playoffs?|regattas?|meets?|practices?|special olympics)\b/;

/**
 * Ordered most specific first: the first rule that matches wins. Athletics
 * leads because fixture titles ("Women's Soccer vs Clark") are the single
 * largest group and are unambiguous.
 *
 * Plurals are spelled out rather than assumed. "Weekly Meetings" is one of
 * the commonest titles in the feed and a bare \bmeeting\b silently misses
 * every one of them, which is exactly the bug the first measurement caught.
 *
 * Two tiers of sport: a named sport wins outright, but the generic contest
 * words sit below the performing-arts rule, because "Dance ... Weekly
 * Practices" is a rehearsal and not a fixture.
 */
const RULES: Array<[EventIcon, RegExp]> = [
  ["athletics", SPORTS],
  ["deadline", /\b(deadlines?|last day|due date|withdraw|registration closes|final day|applications? close)\b/],
  ["career", /\b(career fair|job fair|internships?|recruit\w*|resumes?|résumés?|networking|employers?|careers?|interviews?|hiring|alumni panel)\b/],
  ["worship", /\b(bible|prayers?|jummah|mass|shabbat|worship|church|chapel|rosary|sermons?|fellowship|catholic|muslim|jewish|hindu|buddhis\w*)\b/],
  ["study", /\b(tutoring|study group|study hall|study break|study session|language table|supplemental learning|review sessions?|office hours|recitations?|exam prep|homework)\b/],
  ["fitness", /\b(yoga|climb\w*|belay|weight training|fitness|workouts?|pilates|zumba|spin class|run club|bouldering|wellness|meditation|stretch\w*)\b/],
  ["stage", /\b(concerts?|recitals?|rehearsals?|rehersals?|dance|band|orchestra|choir|theatre|theater|improv|a cappella|acappella|showcases?|performances?|open mic|karaoke|bachata|salsa|ballet|jazz|singers?)\b/],
  // Only now: a bare "practice" or "tournament" means sport, but only
  // once dance, band and choir have had their say.
  ["athletics", CONTESTS],
  ["arts", /\b(exhibitions?|exhibits?|galler(y|ies)|open studio|sculpture|painting|photo contest|photography|film screening|screenings?|craft\w*|pottery)\b/],
  ["talk", /\b(lectures?|seminars?|colloquiu\w*|grand rounds|info sessions?|information sessions?|panels?|symposi\w*|keynotes?|speaker series|guest speakers?|workshops?|teach-in|conferences?|forums?|roundtables?|talks?|discussions?|debates?|readings?|book club)\b/],
  ["food", /\b(pizza|dinners?|lunch\w*|breakfast|brunch|picnics?|bbq|barbecue|potluck|bake sale|tasting|coffee|tea time|food trucks?|boba|snacks?|donuts?|bagels?|ice cream)\b/],
  ["outdoors", /\b(hikes?|hiking|trails?|stargazing|camping|kayak\w*|canoe\w*|river|gardens?|clean-?up|nature walk|beach|farm)\b/],
  ["celebration", /\b(part(y|ies)|formals?|semi-formals?|galas?|mixers?|socials?|celebrations?|festivals?|homecoming|birthdays?|banquets?|tailgates?|trivia|game night|bingo|spirit week|prom|scavenger hunt|movie night|happy hour)\b/],
  ["meeting", /\b(gbms?|general body|weekly meetings?|biweekly|chapter|staff meetings?|board meetings?|e-?board|exec(utive)? meetings?|club fair|activities fair|tabling|meetings?|orientation|councils?|committees?|elections?|assembl(y|ies)|town hall|small groups?|gatherings?)\b/],
];

const FIXTURE = /\b(men'?s|women'?s|varsity|jv)\b.*\b(vs\.?|at)\b/;

export function iconFor(input: {
  title?: string | null;
  type?: string | null;
  host?: string | null;
}): EventIcon {
  const typed = input.type ? BY_EVENT_TYPE[input.type] : undefined;
  if (typed) return typed;

  const text = `${input.title ?? ""} ${input.host ?? ""}`.toLowerCase();
  if (!text.trim()) return DEFAULT_ICON;

  for (const [icon, pattern] of RULES) {
    if (pattern.test(text)) return icon;
  }
  if (FIXTURE.test(text)) return "athletics";
  return DEFAULT_ICON;
}
