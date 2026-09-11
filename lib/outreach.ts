import type {
  CollaboratorKind,
  EventType,
  ListingCategory,
} from "@/generated/prisma/enums";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";

/**
 * Drafts the first message to a venue or vendor.
 *
 * With no supply side, this is what "booking" actually means in HostKit: the
 * host still has to email a real business. Everything the recipient needs to
 * quote accurately is already in the message — date, headcount, duration,
 * city — because the most common reason a first inquiry bounces back is that
 * it didn't say any of that.
 *
 * The budget is deliberately never mentioned. Telling a vendor what you have
 * to spend is how it becomes what you spend.
 */

export type OutreachEvent = {
  title: string;
  type: EventType;
  date: Date | null;
  endDate: Date | null;
  datesFlexible: boolean;
  guestCount: number;
  durationHours: number;
  city: string;
  vibe: string | null;
};

/** The questions worth asking up front, per category. */
const QUESTIONS: Partial<Record<ListingCategory, string[]>> = {
  VENUE: [
    "Is the date available, and can you hold it while we decide?",
    "What does the hire fee include, and is there a minimum spend?",
    "What are the access times for setup and clear-down?",
    "Do we have to use suppliers from a preferred list?",
  ],
  CATERING: [
    "What would you suggest for this many guests, and what is the per-head cost?",
    "Are staff and equipment included, or charged separately?",
    "How do you handle dietary requirements and allergies?",
    "Do you offer a tasting, and when would we need to confirm numbers?",
  ],
  PHOTOGRAPHY: [
    "Are you free on the date?",
    "What do your packages cover, and is a second shooter included?",
    "How long until we get the gallery?",
  ],
  VIDEOGRAPHY: [
    "Are you free on the date?",
    "What is included — highlight film, full ceremony, raw footage?",
    "What is the turnaround?",
  ],
  MUSIC_DJ: [
    "Are you free on the date?",
    "Do you bring your own sound and lighting?",
    "How long do you play for, and what does overtime cost?",
  ],
  AV_PRODUCTION: [
    "Are you free on the date?",
    "Will a technician be on site for the whole event?",
    "Can you do a site visit and a tech rehearsal beforehand?",
  ],
  FLORALS: [
    "Are you free on the date?",
    "What is realistically in season then?",
    "Do you deliver, install and come back to strike?",
  ],
  BAR_SERVICE: [
    "Are you free on the date?",
    "Are you licensed, and is that included?",
    "How many bartenders would you recommend for this many guests?",
  ],
  CAKE_DESSERT: [
    "Are you free on the date?",
    "What sizes work for this many guests?",
    "Can you handle dietary requirements?",
  ],
  RENTALS: [
    "Do you have availability for the date?",
    "Is delivery, setup and collection included?",
    "When do items need to be back?",
  ],
  TRANSPORT: [
    "Are you free on the date?",
    "What size vehicles do you have, and how many runs would this need?",
    "How late can the last run be?",
  ],
  STAFFING: [
    "Are you free on the date?",
    "How many staff would you recommend for this many guests?",
    "Is a floor lead or coordinator included?",
  ],
  DECOR_STYLING: [
    "Are you free on the date?",
    "Do you install and strike, or is that on us?",
    "Can you work with what the venue already has?",
  ],
  INVITATIONS: [
    "What is your lead time from artwork to delivered invitations?",
    "Do you handle addressing and postage?",
    "Can you set up digital RSVPs too?",
  ],
};

const DEFAULT_QUESTIONS = [
  "Are you available on the date?",
  "What would this cost, and what does that include?",
  "When would you need us to confirm?",
];

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** How the date is described — a fixed day, a window, or still undecided. */
export function describeDate(event: OutreachEvent): string {
  if (!event.date) return "We haven't locked the date yet";
  if (event.datesFlexible && event.endDate) {
    return `We're looking at ${formatDate(event.date)} to ${formatDate(event.endDate)}, and we have some flexibility`;
  }
  return `The date is ${formatDate(event.date)}`;
}

/** What to ask people who aren't catalog vendors. */
const KIND_QUESTIONS: Record<CollaboratorKind, string[]> = {
  VENUE: QUESTIONS.VENUE!,
  SPEAKER: [
    "Are you free on the date, and roughly how long would you want on stage?",
    "Is there anything you'd need from us — AV, a mic, slides?",
    "Do you have a short bio and a headshot we can use to promote it?",
  ],
  COHOST: [
    "Are you in for the date?",
    "Which parts would you want to own — door, promo, the run of show?",
    "Anyone you'd want to bring in?",
  ],
};

/**
 * Drafts the first message to anyone the host is lining up: a catalog
 * listing (questions by vendor category), a venue, speaker or cohost
 * (questions by kind), or someone with neither (general questions).
 */
export function composeInquiry(
  event: OutreachEvent,
  target: { name: string; category?: ListingCategory | null; role?: CollaboratorKind | null },
  hostName: string,
): { subject: string; body: string } {
  const eventLabel = EVENT_TYPE_LABEL[event.type].toLowerCase();
  const questions =
    (target.category ? QUESTIONS[target.category] : undefined) ??
    (target.role ? KIND_QUESTIONS[target.role] : undefined) ??
    DEFAULT_QUESTIONS;
  const listing = target;

  const subject = event.date
    ? `${EVENT_TYPE_LABEL[event.type]} inquiry — ${formatDate(event.date)}, ${event.guestCount} guests`
    : `${EVENT_TYPE_LABEL[event.type]} inquiry — ${event.guestCount} guests`;

  const body = [
    `Hello ${listing.name},`,
    "",
    `I'm planning a ${eventLabel} in ${event.city} for around ${event.guestCount} guests, running about ${event.durationHours} hours. ${describeDate(event)}.`,
    ...(event.vibe ? ["", `What we're going for: ${event.vibe}`] : []),
    "",
    "A few things it would help to know:",
    ...questions.map((question) => `  • ${question}`),
    "",
    "If you're free and it sounds like a fit, I'd love to talk.",
    "",
    "Thanks,",
    hostName,
  ].join("\n");

  return { subject, body };
}

/** A mailto: link for the composed message, for hosts who want to just send it. */
export function mailtoLink(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
