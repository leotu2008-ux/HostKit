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
  HAIR_MAKEUP: "Hair & makeup",
  OFFICIANT: "Officiant",
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
  HAIR_MAKEUP: "hair & makeup",
  OFFICIANT: "officiant",
  TRANSPORT: "transport",
  STAFFING: "event staff",
  DECOR_STYLING: "stylist",
  INVITATIONS: "invitations",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  WEDDING: "Wedding",
  BIRTHDAY: "Birthday party",
  CORPORATE_OFFSITE: "Corporate offsite",
  LAUNCH_PARTY: "Launch party",
  BABY_SHOWER: "Baby shower",
  DINNER_PARTY: "Dinner party",
  FUNDRAISER: "Fundraiser",
  ENGAGEMENT: "Engagement party",
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABEL) as ListingCategory[];
export const ALL_EVENT_TYPES = Object.keys(EVENT_TYPE_LABEL) as EventType[];

export function categoryLabel(category: ListingCategory) {
  return CATEGORY_LABEL[category];
}

/** Cities the seeded catalog covers. Kept next to the catalog vocabulary so
 *  the intake form and the seed script can never drift apart. */
export const CITIES = [
  "New York, NY",
  "Los Angeles, CA",
  "Austin, TX",
] as const;

export type City = (typeof CITIES)[number];

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
