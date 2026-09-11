import type { EventType, ListingCategory } from "@/generated/prisma/enums";
import { CATEGORY_LABEL } from "@/lib/catalog";

/**
 * The day-of run sheet: who arrives when, and what happens in what order.
 *
 * HostKit seeds a first draft rather than handing over an empty table,
 * because the hardest part of a run sheet is remembering the things nobody
 * thinks about until they go wrong — load-in access, the briefing, the fact
 * that the florist needs the room two hours before anyone sees it.
 *
 * Times are suggestions. Every row is editable, and the generated draft is
 * explicitly a starting point.
 */

export type RunSheetDraft = {
  /** Minutes relative to guests arriving. Negative is before. */
  offsetMinutes: number;
  title: string;
  owner: string | null;
  notes: string | null;
};

/** When this kind of event typically starts, in local hours. */
const DEFAULT_START_HOUR: Record<EventType, number> = {
  WEDDING: 15,
  ENGAGEMENT: 17,
  BIRTHDAY: 19,
  CORPORATE_OFFSITE: 9,
  LAUNCH_PARTY: 18,
  BABY_SHOWER: 13,
  DINNER_PARTY: 19,
  FUNDRAISER: 18,
};

export function defaultStartHour(type: EventType): number {
  return DEFAULT_START_HOUR[type];
}

/** How long before guests arrive each kind of supplier needs the room. */
const LOAD_IN_MINUTES: Partial<Record<ListingCategory, number>> = {
  RENTALS: 300,
  DECOR_STYLING: 240,
  AV_PRODUCTION: 240,
  FLORALS: 180,
  CATERING: 180,
  BAR_SERVICE: 120,
  MUSIC_DJ: 120,
  CAKE_DESSERT: 90,
  STAFFING: 90,
  PHOTOGRAPHY: 60,
  VIDEOGRAPHY: 60,
  HAIR_MAKEUP: 300,
  OFFICIANT: 45,
  TRANSPORT: 30,
};

/** The running order after guests arrive, per event type. */
const RUNNING_ORDER: Record<EventType, Array<[number, string]>> = {
  WEDDING: [
    [0, "Guests arrive"],
    [30, "Ceremony"],
    [60, "Drinks and group photos"],
    [120, "Call guests through to dinner"],
    [135, "Dinner served"],
    [225, "Speeches"],
    [270, "Cut the cake"],
    [285, "First dance, band or DJ starts"],
  ],
  ENGAGEMENT: [
    [0, "Guests arrive"],
    [45, "Drinks and canapés"],
    [90, "Toast"],
    [120, "Music on"],
  ],
  BIRTHDAY: [
    [0, "Guests arrive"],
    [45, "Food served"],
    [120, "Cake and singing"],
    [150, "Music up, lights down"],
  ],
  CORPORATE_OFFSITE: [
    [0, "Registration and coffee"],
    [30, "Opening session"],
    [120, "Break"],
    [150, "Morning workshops"],
    [240, "Lunch"],
    [300, "Afternoon sessions"],
    [420, "Closing and drinks"],
  ],
  LAUNCH_PARTY: [
    [0, "Doors open"],
    [45, "Welcome drinks"],
    [60, "Presentation"],
    [90, "Press photos"],
    [120, "Open floor"],
  ],
  BABY_SHOWER: [
    [0, "Guests arrive"],
    [30, "Food and drinks"],
    [75, "Games"],
    [120, "Gifts and cake"],
  ],
  DINNER_PARTY: [
    [0, "Guests arrive"],
    [30, "Drinks"],
    [60, "Sit down, starters"],
    [90, "Main course"],
    [140, "Dessert"],
    [180, "Coffee"],
  ],
  FUNDRAISER: [
    [0, "Doors and reception"],
    [45, "Guests seated"],
    [60, "Welcome from the host"],
    [90, "Dinner served"],
    [165, "The ask and pledges"],
    [195, "Auction"],
    [240, "Music and close"],
  ],
};

/** The setup steps every event needs regardless of type. */
const SETUP: RunSheetDraft[] = [
  {
    offsetMinutes: -60,
    title: "Final walkthrough",
    owner: null,
    notes: "Walk the room as a guest would. Fix what you notice now.",
  },
  {
    offsetMinutes: -30,
    title: "Brief everyone working",
    owner: null,
    notes: "Running order, who to ask, where things are.",
  },
];

/**
 * Builds the first draft of a run sheet from the event and its bookings.
 *
 * Pure, so the ordering and the load-in maths are testable without a
 * database or a clock.
 */
export function suggestRunSheet(
  event: { type: EventType; durationHours: number },
  bookedCategories: Array<{ category: ListingCategory; name: string }>,
): RunSheetDraft[] {
  const loadIns: RunSheetDraft[] = bookedCategories.map(
    ({ category, name }) => ({
      offsetMinutes: -(LOAD_IN_MINUTES[category] ?? 120),
      title: `${CATEGORY_LABEL[category]} load-in`,
      owner: name,
      notes: null,
    }),
  );

  const running: RunSheetDraft[] = RUNNING_ORDER[event.type]
    // Never schedule the running order past the end of the event.
    .filter(([offset]) => offset <= event.durationHours * 60)
    .map(([offsetMinutes, title]) => ({
      offsetMinutes,
      title,
      owner: null,
      notes: null,
    }));

  const close: RunSheetDraft[] = [
    {
      offsetMinutes: event.durationHours * 60,
      title: "Carriages",
      owner: null,
      notes: null,
    },
    {
      offsetMinutes: event.durationHours * 60 + 30,
      title: "Clear down and vendor collection",
      owner: null,
      notes: "Check who is collecting what, and when.",
    },
  ];

  return [...loadIns, ...SETUP, ...running, ...close].sort(
    (a, b) =>
      a.offsetMinutes - b.offsetMinutes || a.title.localeCompare(b.title),
  );
}

/** Turns an offset into a real timestamp on the event's date. */
export function draftToDate(
  eventDate: Date,
  startHour: number,
  offsetMinutes: number,
): Date {
  const start = new Date(eventDate);
  start.setHours(startHour, 0, 0, 0);
  return new Date(start.getTime() + offsetMinutes * 60_000);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
