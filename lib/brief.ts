import { createHash } from "node:crypto";
import type { EventType } from "@/generated/prisma/enums";
import { isCity } from "@/lib/catalog";

/**
 * What "not filled in yet" means for an event, in one place.
 *
 * A blank event is a real row from the moment Create event is pressed — see
 * the migration comment in prisma/migrations/20260921150000_blank_event_activity_agent_run.
 * Everything downstream (publish, the agent, display) asks this module
 * whether the host has actually said anything yet, rather than re-deriving
 * "empty" from field values itself.
 */

export const UNTITLED = "Untitled event";
export const FALLBACK_TYPE: EventType = "MIXER";

export type BriefFacts = {
  title: string;
  kind: string | null;
  type: EventType;
  date: Date | null;
  durationHours: number;
  city: string;
  guestCount: number;
  budgetTotalCents: number;
  vibe: string | null;
  description: string | null;
};

/** The facts a complete brief needs, in the order they're asked about. */
export const BRIEF_FIELDS = ["kind", "date", "city", "guests", "budget"] as const;
export type BriefField = (typeof BRIEF_FIELDS)[number];

const FIELD_LABEL: Record<BriefField, string> = {
  kind: "a kind of event",
  date: "a date",
  city: "a city",
  guests: "a headcount",
  budget: "a budget",
};

/** The fields still missing from a brief, in `BRIEF_FIELDS` order. Time-free
 *  on purpose — nothing here depends on "now", so it's safe to call anywhere. */
export function missingBriefFields(brief: BriefFacts): BriefField[] {
  const missing: BriefField[] = [];
  if (!((brief.kind ?? "").trim().length > 0)) missing.push("kind");
  if (!(brief.date instanceof Date && !Number.isNaN(brief.date.getTime()))) missing.push("date");
  if (!isCity(brief.city)) missing.push("city");
  if (!(Number.isInteger(brief.guestCount) && brief.guestCount >= 1)) missing.push("guests");
  if (!(Number.isInteger(brief.budgetTotalCents) && brief.budgetTotalCents > 0)) missing.push("budget");
  return missing;
}

export function briefIsComplete(brief: BriefFacts): boolean {
  return missingBriefFields(brief).length === 0;
}

/** "a kind", "a date and a city", "a date, a city and a budget"; "" for none. */
export function describeMissing(fields: BriefField[]): string {
  const labels = fields.map((f) => FIELD_LABEL[f]);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * Keyword table mapping the host's own words to a planning type, walked in
 * order — first match wins. Order matters: LAUNCH_PARTY comes before MIXER
 * so "launch party" isn't scored as a party; BIRTHDAY comes before
 * DINNER_PARTY so "birthday dinner" reads as a birthday; MIXER's words are
 * the broadest ("party", "night") so they go last, catching only what
 * nothing more specific already claimed.
 */
const KIND_KEYWORDS: Array<[EventType, string[]]> = [
  ["PITCH_NIGHT", ["pitch", "demo day", "demo night", "shark tank", "startup competition"]],
  ["FORMAL", ["formal", "gala", "black tie", "ball", "prom"]],
  ["FUNDRAISER", ["fundraiser", "benefit", "charity", "philanthropy", "raiser"]],
  ["STUDY_BREAK", ["study break", "finals", "midterm", "de stress", "destress", "study"]],
  ["LAUNCH_PARTY", ["launch", "release party", "debut", "premiere"]],
  ["BIRTHDAY", ["birthday", "bday", "21st", "18th", "turning"]],
  ["CORPORATE_OFFSITE", ["offsite", "off site", "retreat", "all hands", "team building", "conference", "summit"]],
  ["GENERAL_MEETING", ["gbm", "general meeting", "general body", "info session", "interest meeting", "orientation", "workshop", "panel", "speaker series", "meeting"]],
  ["DINNER_PARTY", ["dinner", "supper", "banquet", "brunch", "lunch", "potluck", "tasting"]],
  ["MIXER", ["mixer", "social", "networking", "happy hour", "meet and greet", "kickback", "party", "night"]],
];

function normalizeKind(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The planning type a free-text kind implies, or null when nothing matches
 *  (including blank input) — unrecognised text still reaches the model
 *  through draftPlan, it just doesn't pick a type here. */
export function eventTypeForKind(text: string | null | undefined): EventType | null {
  const normalized = normalizeKind(text ?? "");
  if (!normalized) return null;
  for (const [type, keywords] of KIND_KEYWORDS) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return type;
  }
  return null;
}

/**
 * A short, stable fingerprint of exactly the facts the agent consumes. A
 * cover change or an RSVP must not re-run it — this hash is how AgentRun's
 * `@@unique([eventId, briefHash])` tells "the same brief" from "a new one".
 */
export function briefHash(brief: BriefFacts): string {
  const canonical = [
    brief.title,
    (brief.kind ?? "").trim().toLowerCase(),
    brief.type,
    brief.date?.toISOString() ?? "",
    String(brief.durationHours),
    brief.city,
    String(brief.guestCount),
    String(brief.budgetTotalCents),
    brief.vibe ?? "",
    brief.description ?? "",
  ].join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/** Whether the event can go live: a complete brief, and a real title —
 *  publishing "Untitled event" would put a placeholder in front of guests. */
export function readyToPublish(brief: BriefFacts): boolean {
  return briefIsComplete(brief) && brief.title.trim() !== "" && brief.title !== UNTITLED;
}
