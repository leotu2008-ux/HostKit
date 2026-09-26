import type {
  EventType,
  InquiryStatus,
  ListingCategory,
} from "@/generated/prisma/enums";

export const CATEGORY_LABEL: Record<ListingCategory, string> = {
  VENUE: "Venue",
  CATERING: "Catering",
  PHOTOGRAPHY: "Photography",
  VIDEOGRAPHY: "Videography",
  FLORALS: "Florals",
  MUSIC_DJ: "Music & DJ",
  AV_PRODUCTION: "AV & production",
  RENTALS: "Rentals",
  BAR_SERVICE: "Bar service",
  CAKE_DESSERT: "Cake & dessert",
  TRANSPORT: "Transport",
  STAFFING: "Staffing",
  DECOR_STYLING: "Decor & styling",
  INVITATIONS: "Invitations",
};

/** Lowercase form for mid-sentence use ("book the venue", "find catering"). */
export const CATEGORY_LABEL_INLINE: Record<ListingCategory, string> = {
  VENUE: "venue",
  CATERING: "caterer",
  PHOTOGRAPHY: "photographer",
  VIDEOGRAPHY: "videographer",
  FLORALS: "florist",
  MUSIC_DJ: "music",
  AV_PRODUCTION: "AV team",
  RENTALS: "rentals",
  BAR_SERVICE: "bar service",
  CAKE_DESSERT: "cake",
  TRANSPORT: "transport",
  STAFFING: "event staff",
  DECOR_STYLING: "stylist",
  INVITATIONS: "invitations",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  BIRTHDAY: "Birthday party",
  CORPORATE_OFFSITE: "Corporate offsite",
  LAUNCH_PARTY: "Launch party",
  DINNER_PARTY: "Dinner party",
  FUNDRAISER: "Fundraiser",
  MIXER: "Mixer",
  GENERAL_MEETING: "General meeting",
  FORMAL: "Formal",
  PITCH_NIGHT: "Pitch night",
  STUDY_BREAK: "Study break",
  NETWORKING: "Networking night",
  WORKSHOP: "Workshop",
  SPEAKER_EVENT: "Speaker event",
  HACKATHON: "Hackathon",
  GAME_NIGHT: "Game night",
  WATCH_PARTY: "Watch party",
  SHOWCASE: "Showcase",
  RUN_CLUB: "Run club",
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as ListingCategory[];
export const ALL_EVENT_TYPES = Object.keys(EVENT_TYPE_LABEL) as EventType[];

/**
 * The picker, in the order a student host should meet it.
 *
 * Ordered rather than alphabetical because the front of this list is what
 * most people will pick, and the real usage that motivated the five new types
 * is student-organisation nights. Anything not named here still appears, in
 * schema order, so a new EventType can never go missing from the form again —
 * the failure this list exists to prevent.
 */
const EVENT_TYPE_ORDER: EventType[] = [
  "MIXER",
  "NETWORKING",
  "GENERAL_MEETING",
  "WORKSHOP",
  "SPEAKER_EVENT",
  "STUDY_BREAK",
  "PITCH_NIGHT",
  "GAME_NIGHT",
  "FORMAL",
  "DINNER_PARTY",
];

export const EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  ...EVENT_TYPE_ORDER,
  ...ALL_EVENT_TYPES.filter((t) => !EVENT_TYPE_ORDER.includes(t)),
].map((value) => ({ value, label: EVENT_TYPE_LABEL[value] }));

export function categoryLabel(category: ListingCategory) {
  return CATEGORY_LABEL[category];
}

/** Cities Hosty knows. The first three have a seeded venue catalog; Boston
 *  is here for the student side. Kept next to the catalog vocabulary so the
 *  intake form, the API and the seed script can never drift apart. */
export const CITIES = [
  "New York, NY",
  "Los Angeles, CA",
  "Austin, TX",
  "Boston, MA",
] as const;

export type City = (typeof CITIES)[number];

/** City centres, for "which city am I in?" without a geocoding service. */
export const CITY_CENTERS: Record<City, { lat: number; lng: number }> = {
  "New York, NY": { lat: 40.7128, lng: -74.006 },
  "Los Angeles, CA": { lat: 34.0522, lng: -118.2437 },
  "Austin, TX": { lat: 30.2672, lng: -97.7431 },
  "Boston, MA": { lat: 42.3601, lng: -71.0589 },
};

/** How far from a centre still counts as "in" that city, in miles. Wellesley
 *  is 13 miles from downtown Boston; 60 covers a metro without crossing to
 *  the next one. */
const CITY_RADIUS_MILES = 60;

/** The nearest known city to a point, or null if none is close enough. */
export function nearestCity(lat: number, lng: number): City | null {
  let best: { city: City; miles: number } | null = null;
  for (const city of CITIES) {
    const centre = CITY_CENTERS[city];
    const miles = milesBetween(lat, lng, centre.lat, centre.lng);
    if (!best || miles < best.miles) best = { city, miles };
  }
  return best && best.miles <= CITY_RADIUS_MILES ? best.city : null;
}

export function isCity(value: string | null | undefined): value is City {
  return (CITIES as readonly string[]).includes(value ?? "");
}

/** Great-circle miles between two points. Exported so lib/cities.ts can reach
 *  the same haversine over its much longer table rather than keep a second
 *  copy of it. */
export function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  REPLIED: "Replied",
  QUOTED: "Quoted",
  BOOKED: "Booked",
  DECLINED: "Declined",
};

/** Statuses in the order an inquiry actually moves through them. */
export const INQUIRY_STATUS_FLOW: InquiryStatus[] = [
  "DRAFT",
  "SENT",
  "REPLIED",
  "QUOTED",
  "BOOKED",
  "DECLINED",
];
