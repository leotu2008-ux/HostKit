import type { EventType, ListingCategory } from "@/generated/prisma/enums";

/**
 * Event templates: what a given kind of event needs, what share of the budget
 * each part typically takes, and the order the work happens in.
 *
 * These live in code rather than the database on purpose. They are typed
 * planning logic that evolves with the app — not user data — and keeping them
 * here means a template change is reviewable in a diff.
 *
 * Timeline positions are expressed as a FRACTION of the planning horizon
 * rather than in absolute days. A fundraiser and a dinner party both "send
 * invitations at 40% of the way in"; only the horizon differs. This also means
 * a fundraiser booked 45 days out compresses sensibly instead of generating a
 * pile of tasks whose due dates are already in the past — see lib/plan.ts.
 *
 * Hosty is for student, professional and fun events, so there are no
 * wedding or family-occasion templates here.
 */

export type BudgetWeight = {
  category: ListingCategory;
  weight: number;
};

export type TaskTemplate = {
  title: string;
  /** 1 = start of planning, 0 = the event itself. */
  at: number;
  category?: ListingCategory;
  notes?: string;
};

export type EventTemplate = {
  type: EventType;
  blurb: string;
  /** Days of planning a comfortably-scheduled version of this event wants. */
  horizonDays: number;
  defaultDurationHours: number;
  defaultGuestCount: number;
  /** Must sum to 1. Asserted by a unit test. */
  budget: BudgetWeight[];
  /** Categories this event is not "covered" without. */
  required: ListingCategory[];
  /** Tasks beyond the universal spine below. */
  extraTasks: TaskTemplate[];
};

/** Where in the horizon each category is worth locking down. Venues go first
 *  because everything else keys off the date and the room. */
const BOOKING_POSITION: Partial<Record<ListingCategory, number>> = {
  VENUE: 0.86,
  CATERING: 0.72,
  PHOTOGRAPHY: 0.66,
  VIDEOGRAPHY: 0.64,
  MUSIC_DJ: 0.6,
  AV_PRODUCTION: 0.58,
  BAR_SERVICE: 0.5,
  STAFFING: 0.46,
  FLORALS: 0.44,
  DECOR_STYLING: 0.42,
  CAKE_DESSERT: 0.4,
  RENTALS: 0.34,
  TRANSPORT: 0.3,
  INVITATIONS: 0.55,
};

export function bookingPosition(category: ListingCategory): number {
  return BOOKING_POSITION[category] ?? 0.5;
}

/**
 * The spine every event shares. Booking tasks are generated separately from
 * the template's `required` list so that a booked inquiry can close the
 * matching task by category.
 */
export const SPINE_TASKS: TaskTemplate[] = [
  {
    title: "Lock the date, the headcount and the budget",
    at: 1,
    notes: "Everything downstream keys off these three numbers.",
  },
  {
    title: "Draft the guest list",
    at: 0.78,
    notes: "You need a headcount before a caterer will quote you properly.",
  },
  {
    title: "Send invitations",
    at: 0.36,
    category: "INVITATIONS",
  },
  {
    title: "Chase outstanding RSVPs",
    at: 0.16,
    notes: "Expect to chase about a third of the list.",
  },
  {
    title: "Confirm final headcount with the caterer",
    at: 0.08,
    notes: "Most caterers lock numbers a week or two out and bill on that.",
  },
  {
    title: "Confirm arrival times with every booked vendor",
    at: 0.05,
  },
  {
    title: "Build the day-of run sheet",
    at: 0.03,
    notes: "Who arrives when, who is responsible, what happens in what order.",
  },
  {
    title: "Final walkthrough and setup",
    at: 0.01,
  },
];

export const EVENT_TEMPLATES: Record<EventType, EventTemplate> = {
  BIRTHDAY: {
    type: "BIRTHDAY",
    blurb: "Short runway, high energy. Food and music carry the night.",
    horizonDays: 60,
    defaultDurationHours: 5,
    defaultGuestCount: 40,
    budget: [
      { category: "VENUE", weight: 0.3 },
      { category: "CATERING", weight: 0.28 },
      { category: "MUSIC_DJ", weight: 0.12 },
      { category: "CAKE_DESSERT", weight: 0.1 },
      { category: "DECOR_STYLING", weight: 0.1 },
      { category: "BAR_SERVICE", weight: 0.1 },
    ],
    required: ["VENUE", "CATERING"],
    extraTasks: [
      { title: "Agree the playlist and any hard nos", at: 0.2 },
      { title: "Order the cake", at: 0.25, category: "CAKE_DESSERT" },
    ],
  },

  CORPORATE_OFFSITE: {
    type: "CORPORATE_OFFSITE",
    blurb: "Runs on logistics. AV failing is the only thing anyone will remember.",
    horizonDays: 90,
    defaultDurationHours: 9,
    defaultGuestCount: 50,
    budget: [
      { category: "VENUE", weight: 0.35 },
      { category: "CATERING", weight: 0.3 },
      { category: "AV_PRODUCTION", weight: 0.15 },
      { category: "TRANSPORT", weight: 0.1 },
      { category: "STAFFING", weight: 0.1 },
    ],
    required: ["VENUE", "CATERING", "AV_PRODUCTION"],
    extraTasks: [
      { title: "Lock the agenda and session owners", at: 0.55 },
      { title: "Collect dietary requirements and accessibility needs", at: 0.3 },
      { title: "Tech rehearsal in the actual room", at: 0.06 },
      { title: "Send joining instructions and directions", at: 0.12 },
    ],
  },

  LAUNCH_PARTY: {
    type: "LAUNCH_PARTY",
    blurb: "A press moment with drinks. The room has to photograph well.",
    horizonDays: 75,
    defaultDurationHours: 4,
    defaultGuestCount: 120,
    budget: [
      { category: "VENUE", weight: 0.3 },
      { category: "CATERING", weight: 0.2 },
      { category: "AV_PRODUCTION", weight: 0.15 },
      { category: "BAR_SERVICE", weight: 0.12 },
      { category: "PHOTOGRAPHY", weight: 0.1 },
      { category: "DECOR_STYLING", weight: 0.08 },
      { category: "STAFFING", weight: 0.05 },
    ],
    required: ["VENUE", "CATERING", "AV_PRODUCTION"],
    extraTasks: [
      { title: "Confirm the run of show and who speaks", at: 0.35 },
      { title: "Brief the photographer on must-have shots", at: 0.1 },
      { title: "Prepare the press and VIP list", at: 0.45 },
    ],
  },

  DINNER_PARTY: {
    type: "DINNER_PARTY",
    blurb: "Small and food-first. Most of the budget is on the plate.",
    horizonDays: 30,
    defaultDurationHours: 4,
    defaultGuestCount: 12,
    budget: [
      { category: "CATERING", weight: 0.4 },
      { category: "VENUE", weight: 0.25 },
      { category: "BAR_SERVICE", weight: 0.15 },
      { category: "FLORALS", weight: 0.1 },
      { category: "RENTALS", weight: 0.1 },
    ],
    required: ["CATERING"],
    extraTasks: [
      { title: "Agree the menu and collect allergies", at: 0.4 },
      { title: "Plan the seating", at: 0.1 },
    ],
  },

  FUNDRAISER: {
    type: "FUNDRAISER",
    blurb: "Every pound spent is a pound not raised. Keep the ratio honest.",
    horizonDays: 120,
    defaultDurationHours: 5,
    defaultGuestCount: 150,
    budget: [
      { category: "VENUE", weight: 0.28 },
      { category: "CATERING", weight: 0.27 },
      { category: "AV_PRODUCTION", weight: 0.12 },
      { category: "STAFFING", weight: 0.1 },
      { category: "DECOR_STYLING", weight: 0.08 },
      { category: "PHOTOGRAPHY", weight: 0.08 },
      { category: "INVITATIONS", weight: 0.07 },
    ],
    required: ["VENUE", "CATERING", "AV_PRODUCTION"],
    extraTasks: [
      { title: "Set the fundraising target and the ask", at: 0.9 },
      { title: "Line up sponsors and auction lots", at: 0.6 },
      { title: "Brief the host and confirm the pledge moment", at: 0.15 },
      { title: "Set up donation collection and test it", at: 0.1 },
    ],
  },

  MIXER: {
    type: "MIXER",
    blurb: "Two clubs, a room, and something to drink.",
    horizonDays: 21,
    defaultDurationHours: 3,
    defaultGuestCount: 60,
    budget: [
      { category: "VENUE", weight: 0.4 },
      { category: "CATERING", weight: 0.3 },
      { category: "MUSIC_DJ", weight: 0.2 },
      { category: "DECOR_STYLING", weight: 0.1 },
    ],
    required: ["VENUE"],
    extraTasks: [
      { title: "Agree the split with the other club", at: 0.9 },
      {
        title: "Confirm the guest cap with the venue",
        at: 0.5,
        category: "VENUE",
      },
    ],
  },

  GENERAL_MEETING: {
    type: "GENERAL_MEETING",
    blurb: "The weekly one. Room, slides, and something to eat.",
    horizonDays: 10,
    defaultDurationHours: 2,
    defaultGuestCount: 40,
    budget: [
      { category: "VENUE", weight: 0.35 },
      { category: "CATERING", weight: 0.5 },
      { category: "AV_PRODUCTION", weight: 0.15 },
    ],
    required: ["VENUE"],
    extraTasks: [
      { title: "Book the room", at: 0.9, category: "VENUE" },
      { title: "Send the agenda", at: 0.2 },
    ],
  },

  FORMAL: {
    type: "FORMAL",
    blurb: "The big one. A room, a bus, and a photographer.",
    horizonDays: 75,
    defaultDurationHours: 5,
    defaultGuestCount: 120,
    budget: [
      { category: "VENUE", weight: 0.35 },
      { category: "CATERING", weight: 0.25 },
      { category: "MUSIC_DJ", weight: 0.12 },
      { category: "TRANSPORT", weight: 0.12 },
      { category: "PHOTOGRAPHY", weight: 0.08 },
      { category: "DECOR_STYLING", weight: 0.08 },
    ],
    required: ["VENUE", "CATERING", "TRANSPORT"],
    extraTasks: [
      { title: "Open ticket sales", at: 0.6 },
      {
        title: "Confirm the coach pickup points",
        at: 0.3,
        category: "TRANSPORT",
      },
      {
        title: "Send the running order to the venue",
        at: 0.1,
        category: "VENUE",
      },
    ],
  },

  PITCH_NIGHT: {
    type: "PITCH_NIGHT",
    blurb: "Founders, judges, a projector that works.",
    horizonDays: 35,
    defaultDurationHours: 3,
    defaultGuestCount: 80,
    budget: [
      { category: "VENUE", weight: 0.35 },
      { category: "AV_PRODUCTION", weight: 0.3 },
      { category: "CATERING", weight: 0.25 },
      { category: "PHOTOGRAPHY", weight: 0.1 },
    ],
    required: ["VENUE", "AV_PRODUCTION"],
    extraTasks: [
      { title: "Confirm the judges", at: 0.7 },
      { title: "Collect the decks", at: 0.25 },
      {
        title: "Test the projector and the clicker",
        at: 0.05,
        category: "AV_PRODUCTION",
      },
    ],
  },

  STUDY_BREAK: {
    type: "STUDY_BREAK",
    blurb: "Free food in the library, at the worst possible week.",
    horizonDays: 7,
    defaultDurationHours: 2,
    defaultGuestCount: 50,
    budget: [
      { category: "CATERING", weight: 0.8 },
      { category: "RENTALS", weight: 0.2 },
    ],
    required: ["CATERING"],
    extraTasks: [{ title: "Clear it with the building", at: 0.6 }],
  },
};

export function templateFor(type: EventType): EventTemplate {
  return EVENT_TEMPLATES[type];
}
