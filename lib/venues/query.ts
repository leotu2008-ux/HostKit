import type { EventType } from "@/generated/prisma/enums";

/**
 * What to type into Apple Maps for this event.
 *
 * Keyed by a Record<EventType, string> rather than a switch so a new
 * EventType is a compile error here, not a silent "search for nothing" at
 * runtime — the failure this file exists to prevent.
 */
const BASE_QUERY: Record<EventType, string> = {
  BIRTHDAY: "party venue",
  CORPORATE_OFFSITE: "meeting venue",
  LAUNCH_PARTY: "event space",
  DINNER_PARTY: "private dining restaurant",
  FUNDRAISER: "banquet hall",
  MIXER: "bar",
  GENERAL_MEETING: "meeting room",
  FORMAL: "banquet hall",
  PITCH_NIGHT: "event space",
  STUDY_BREAK: "cafe",
  NETWORKING: "cocktail lounge",
  WORKSHOP: "workshop space",
  SPEAKER_EVENT: "auditorium",
  HACKATHON: "event space",
  GAME_NIGHT: "pub trivia night",
  WATCH_PARTY: "sports bar",
  SHOWCASE: "live music venue",
  RUN_CLUB: "coffee shop",
};

const MAX_VIBE_WORDS = 2;
const MAX_VIBE_CHARS = 40;

/**
 * The host's free-text "vibe" goes straight into a third-party search URL,
 * so nothing but plain words survives: strip anything that isn't a letter or
 * digit, keep at most two words, and cap the whole thing at 40 characters.
 */
function sanitizeVibe(vibe: string | null | undefined): string {
  if (!vibe) return "";
  const words = vibe
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, MAX_VIBE_WORDS);
  return words.join(" ").slice(0, MAX_VIBE_CHARS);
}

export type VenueQueryInput = {
  type: EventType;
  guestCount: number;
  vibe?: string | null;
};

/** The search string for Apple Maps: a term keyed to the event type, plus
 *  whatever survives sanitizing the host's vibe text. guestCount is part of
 *  the contract (rankVenues and rankVenuesForEvent use the same event shape)
 *  even though the search term itself doesn't vary by headcount today. */
export function venueQueryFor(input: VenueQueryInput): string {
  const base = BASE_QUERY[input.type];
  const vibe = sanitizeVibe(input.vibe);
  return vibe ? `${base} ${vibe}` : base;
}
