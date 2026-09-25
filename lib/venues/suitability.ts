import type { EventType } from "@/generated/prisma/enums";
import type { SpaceKind } from "@/lib/ai/venue-judge";
import type { VenueResult } from "@/lib/venues/types";

/**
 * Which places suit which night, decided by code before Jev sees anything.
 *
 * A maps result carries a type (Google's `bar`, `university`; Apple's
 * `Nightlife`) and nothing about capacity, price or availability. So the
 * type is the one certain filter there is: a networking night never needs a
 * nightclub, a formal never needs a pub. Everything past it is Jev's
 * judgement (lib/ai/venue-judge.ts), which reads `spaceKinds` and
 * `needsPrivateSpace` from here.
 *
 * Free sources are rooms that often cost nothing: a university's, for its
 * students, and a public library's or community centre's, for anyone. Hosty
 * can't book them or know they're free, so they're tagged "may be free" and
 * the host checks.
 */

export type FreeSource = "campus" | "public";

export const FREE_SOURCES: Record<FreeSource, { search: string; types: string[]; tag: string; reason: string }> = {
  // Universities only. Google's generic `school` also covers driving and
  // dance schools, and K-12 schools don't host outside adult events.
  campus: {
    search: "university event space",
    types: ["university", "University"],
    tag: "may be free for students",
    reason: "May be free for students · Check with the school's event office",
  },
  public: {
    search: "public library meeting room",
    types: ["library", "community_center", "Library"],
    tag: "often free",
    reason: "Often free · Check with the library or centre",
  },
};

/** Campus first: a university library is a campus room. */
const FREE_ORDER: FreeSource[] = ["campus", "public"];

export type PlaceProfile = {
  /** Searches beyond venueQueryFor's, so one word ("bar") isn't the whole scan. */
  searches: string[];
  /** Google place types (Table A) that suit the night. */
  googleTypes: string[];
  /** Apple Maps poiCategory values that suit the night. */
  appleCategories: string[];
  /** Types that rule a place out even when another of its types suits. */
  excludedTypes: string[];
  /** Jev's space kinds that suit the night; anything else is vetoed. */
  spaceKinds: SpaceKind[];
  /** Whether Jev's confident "no private space" rules a place out. */
  needsPrivateSpace: boolean;
  /** Free rooms worth offering for this night. */
  freeSources: FreeSource[];
};

export const PLACE_PROFILES: Record<EventType, PlaceProfile> = {
  BIRTHDAY: {
    searches: ["bar with private room", "karaoke bar"],
    googleTypes: ["event_venue", "banquet_hall", "bar", "pub", "wine_bar", "cocktail_bar", "lounge_bar", "night_club", "karaoke", "bowling_alley", "amusement_center", "restaurant", "brewery", "brewpub", "beer_garden"],
    appleCategories: ["Nightlife", "Restaurant", "Brewery", "Winery", "Bowling", "MusicVenue"],
    excludedTypes: [],
    spaceKinds: ["bar", "restaurant", "hall", "outdoor"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  CORPORATE_OFFSITE: {
    searches: ["hotel meeting room", "conference venue"],
    googleTypes: ["event_venue", "convention_center", "hotel", "coworking_space", "banquet_hall", "cultural_center"],
    appleCategories: ["Hotel", "ConventionCenter"],
    excludedTypes: [],
    spaceKinds: ["hall", "meeting"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  LAUNCH_PARTY: {
    searches: ["rooftop bar", "gallery event space"],
    googleTypes: ["event_venue", "banquet_hall", "art_gallery", "museum", "cultural_center", "bar", "cocktail_bar", "lounge_bar", "night_club", "brewery"],
    appleCategories: ["Nightlife", "Museum", "Brewery", "MusicVenue"],
    excludedTypes: [],
    spaceKinds: ["bar", "hall", "outdoor", "restaurant"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  DINNER_PARTY: {
    searches: ["restaurant private room", "wine bar"],
    googleTypes: ["restaurant", "fine_dining_restaurant", "wine_bar", "event_venue"],
    appleCategories: ["Restaurant", "Winery"],
    excludedTypes: [],
    spaceKinds: ["restaurant", "bar"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  FUNDRAISER: {
    searches: ["event space", "hotel ballroom"],
    googleTypes: ["banquet_hall", "event_venue", "cultural_center", "art_gallery", "museum", "hotel"],
    appleCategories: ["Hotel", "Museum", "ConventionCenter"],
    excludedTypes: [],
    spaceKinds: ["hall", "restaurant", "bar"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  MIXER: {
    searches: ["lounge", "brewery"],
    googleTypes: ["bar", "pub", "wine_bar", "cocktail_bar", "lounge_bar", "brewery", "brewpub", "beer_garden", "event_venue"],
    appleCategories: ["Nightlife", "Brewery", "Winery"],
    excludedTypes: [],
    spaceKinds: ["bar", "hall", "outdoor", "restaurant"],
    needsPrivateSpace: true,
    freeSources: ["campus"],
  },
  GENERAL_MEETING: {
    searches: ["event space", "coworking space"],
    googleTypes: ["event_venue", "coworking_space", "cultural_center", "hotel", "convention_center"],
    appleCategories: ["ConventionCenter", "Hotel"],
    excludedTypes: [],
    spaceKinds: ["meeting", "hall"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  FORMAL: {
    searches: ["ballroom", "hotel ballroom"],
    googleTypes: ["banquet_hall", "event_venue", "hotel", "wedding_venue"],
    appleCategories: ["Hotel"],
    excludedTypes: [],
    spaceKinds: ["hall"],
    needsPrivateSpace: true,
    freeSources: [],
  },
  PITCH_NIGHT: {
    searches: ["auditorium", "coworking space"],
    googleTypes: ["event_venue", "auditorium", "coworking_space", "convention_center", "cultural_center", "performing_arts_theater"],
    appleCategories: ["ConventionCenter", "Theater"],
    excludedTypes: [],
    spaceKinds: ["hall", "meeting"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  STUDY_BREAK: {
    searches: ["coffee shop", "bakery"],
    googleTypes: ["cafe", "coffee_shop", "bakery", "event_venue"],
    appleCategories: ["Cafe", "Bakery"],
    excludedTypes: [],
    spaceKinds: ["cafe", "hall", "meeting"],
    needsPrivateSpace: false,
    freeSources: ["campus", "public"],
  },
  NETWORKING: {
    searches: ["hotel bar", "event space"],
    googleTypes: ["lounge_bar", "cocktail_bar", "wine_bar", "bar", "event_venue", "hotel", "coworking_space", "restaurant"],
    appleCategories: ["Hotel", "Nightlife", "Winery"],
    // Somewhere people can hear each other.
    excludedTypes: ["night_club", "sports_bar", "karaoke"],
    spaceKinds: ["bar", "hall", "meeting", "restaurant"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  WORKSHOP: {
    searches: ["event space", "coworking space"],
    googleTypes: ["event_venue", "coworking_space", "cultural_center", "art_gallery", "hotel", "convention_center"],
    appleCategories: ["ConventionCenter", "Hotel"],
    excludedTypes: [],
    spaceKinds: ["meeting", "hall", "cafe"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  SPEAKER_EVENT: {
    searches: ["event space", "lecture hall"],
    googleTypes: ["auditorium", "event_venue", "performing_arts_theater", "cultural_center", "convention_center", "coworking_space", "hotel"],
    appleCategories: ["Theater", "ConventionCenter", "Hotel"],
    excludedTypes: [],
    spaceKinds: ["hall", "meeting"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  HACKATHON: {
    searches: ["coworking space", "convention center"],
    googleTypes: ["event_venue", "coworking_space", "convention_center"],
    appleCategories: ["ConventionCenter"],
    excludedTypes: [],
    spaceKinds: ["hall", "meeting"],
    needsPrivateSpace: true,
    freeSources: ["campus"],
  },
  GAME_NIGHT: {
    searches: ["board game cafe", "pub"],
    googleTypes: ["pub", "bar", "cafe", "brewery", "brewpub", "amusement_center", "bowling_alley", "event_venue"],
    appleCategories: ["Nightlife", "Cafe", "Brewery", "Bowling"],
    excludedTypes: ["night_club"],
    spaceKinds: ["bar", "cafe", "hall", "restaurant"],
    needsPrivateSpace: false,
    freeSources: ["campus", "public"],
  },
  WATCH_PARTY: {
    searches: ["bar with big screens", "movie theater private screening"],
    googleTypes: ["sports_bar", "bar", "pub", "brewery", "brewpub", "movie_theater", "event_venue"],
    appleCategories: ["Nightlife", "Brewery", "MovieTheater"],
    excludedTypes: [],
    spaceKinds: ["bar", "hall", "restaurant"],
    needsPrivateSpace: false,
    freeSources: ["campus"],
  },
  SHOWCASE: {
    searches: ["open mic bar", "small theater"],
    googleTypes: ["live_music_venue", "performing_arts_theater", "concert_hall", "comedy_club", "auditorium", "bar", "cafe", "event_venue"],
    appleCategories: ["MusicVenue", "Theater", "Nightlife"],
    excludedTypes: [],
    spaceKinds: ["bar", "hall", "cafe"],
    needsPrivateSpace: true,
    freeSources: ["campus", "public"],
  },
  RUN_CLUB: {
    searches: ["brewery", "cafe"],
    googleTypes: ["cafe", "coffee_shop", "brewery", "brewpub", "beer_garden", "park"],
    appleCategories: ["Cafe", "Brewery", "Park"],
    excludedTypes: [],
    spaceKinds: ["cafe", "bar", "outdoor"],
    needsPrivateSpace: false,
    freeSources: [],
  },
};

/** Google types so generic (a small function room gets `point_of_interest`
 *  and `establishment` alongside, or instead of, anything specific) that they
 *  say nothing about fit — ignored before deciding, so a place that only
 *  carries these reads as "unknown", not "no". `place_of_worship` is
 *  deliberately not here: it's specific enough to rule a place out. */
const GENERIC_GOOGLE_TYPES = ["point_of_interest", "establishment", "food", "store", "premise", "health", "finance"];

/** Whether a place's types suit the night. "unknown" when the provider gave
 *  no types, or only generic ones: kept, and left to Jev, rather than
 *  dropped for silence. */
export function placeFit(venue: Pick<VenueResult, "types">, type: EventType): "yes" | "no" | "unknown" {
  const types = (venue.types ?? []).filter((t) => !GENERIC_GOOGLE_TYPES.includes(t));
  if (types.length === 0) return "unknown";
  const profile = PLACE_PROFILES[type];
  if (types.some((t) => profile.excludedTypes.includes(t))) return "no";
  return types.some((t) => profile.googleTypes.includes(t) || profile.appleCategories.includes(t)) ? "yes" : "no";
}

/** The free source a place belongs to, when that source suits this night. */
export function freeSourceFor(venue: Pick<VenueResult, "types">, type: EventType): FreeSource | null {
  const types = venue.types ?? [];
  const wanted = PLACE_PROFILES[type].freeSources;
  for (const source of FREE_ORDER) {
    if (!wanted.includes(source)) continue;
    if (types.some((t) => FREE_SOURCES[source].types.includes(t))) return source;
  }
  return null;
}
