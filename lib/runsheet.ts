import type { EventType, ListingCategory } from "@/generated/prisma/enums";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { hasClock } from "@/lib/when";

/**
 * The day-of run sheet: who arrives when, and what happens in what order.
 *
 * Hosty seeds a first draft rather than handing over an empty table,
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
  BIRTHDAY: 19,
  CORPORATE_OFFSITE: 9,
  LAUNCH_PARTY: 18,
  DINNER_PARTY: 19,
  FUNDRAISER: 18,
  // Entries below added alongside the campus event types in lib/templates.ts —
  // this Record is exhaustive over EventType, so the enum change forces it.
  MIXER: 19,
  GENERAL_MEETING: 18,
  FORMAL: 19,
  PITCH_NIGHT: 18,
  STUDY_BREAK: 20,
  NETWORKING: 18,
  WORKSHOP: 18,
  SPEAKER_EVENT: 18,
  HACKATHON: 9,
  GAME_NIGHT: 19,
  WATCH_PARTY: 19,
  SHOWCASE: 19,
  RUN_CLUB: 8,
};

export function defaultStartHour(type: EventType): number {
  return DEFAULT_START_HOUR[type];
}

/** When guests arrive: the start time the host saved, or this kind of
 *  event's usual hour when they only gave a date. */
export function arrivalClock(
  eventDate: Date,
  type: EventType,
): { hour: number; minute: number } {
  return hasClock(eventDate)
    ? { hour: eventDate.getHours(), minute: eventDate.getMinutes() }
    : { hour: defaultStartHour(type), minute: 0 };
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
  TRANSPORT: 30,
};

/** The running order after guests arrive, per event type. */
const RUNNING_ORDER: Record<EventType, Array<[number, string]>> = {
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
  // Entries below added alongside the campus event types in lib/templates.ts —
  // this Record is exhaustive over EventType, so the enum change forces it.
  MIXER: [
    [0, "Doors open"],
    [30, "Drinks flowing"],
    [90, "Mixer activity or icebreaker"],
    [150, "Last call"],
  ],
  GENERAL_MEETING: [
    [0, "Members arrive, food out"],
    [15, "Meeting called to order"],
    [90, "Open floor and announcements"],
    [110, "Wrap up"],
  ],
  FORMAL: [
    [0, "Doors and photos"],
    [45, "Guests seated"],
    [60, "Dinner served"],
    [150, "Speeches or awards"],
    [180, "Dance floor opens"],
    [270, "Last dance"],
  ],
  PITCH_NIGHT: [
    [0, "Doors open, judges seated"],
    [20, "Welcome and rules"],
    [30, "Pitches begin"],
    [140, "Judges deliberate"],
    [160, "Winners announced"],
  ],
  STUDY_BREAK: [
    [0, "Doors open, food out"],
    [90, "Last call for food"],
  ],
  NETWORKING: [
    [0, "Doors open, name tags on"],
    [20, "Welcome and how tonight works"],
    [30, "Open networking"],
    [105, "Last call"],
    [115, "Wrap up"],
  ],
  WORKSHOP: [
    [0, "Arrivals, settle in at the tables"],
    [15, "Intro and what we'll make"],
    [25, "Hands-on session"],
    [100, "Show and tell"],
    [115, "Wrap up"],
  ],
  SPEAKER_EVENT: [
    [0, "Doors open"],
    [15, "Welcome and introductions"],
    [20, "Talk or panel"],
    [80, "Questions from the floor"],
    [100, "Mingle"],
  ],
  HACKATHON: [
    [0, "Check-in"],
    [60, "Kickoff and team forming"],
    [120, "Hacking starts"],
    [720, "Midnight food"],
    [1260, "Hacking ends, submissions due"],
    [1320, "Demos and judging"],
    [1410, "Winners announced"],
  ],
  GAME_NIGHT: [
    [0, "Doors open, teams form"],
    [20, "Round one"],
    [80, "Break"],
    [95, "Final rounds"],
    [160, "Winners announced"],
  ],
  WATCH_PARTY: [
    [0, "Doors open, food out"],
    [30, "Kickoff or film starts"],
    [90, "Halftime or intermission"],
    [170, "Final whistle or credits"],
  ],
  SHOWCASE: [
    [0, "Doors open"],
    [15, "Host opens the show"],
    [20, "First half"],
    [95, "Intermission"],
    [110, "Second half"],
    [170, "Closing"],
  ],
  RUN_CLUB: [
    [0, "Meet and warm up"],
    [15, "Run starts"],
    [60, "Back at the meeting point"],
    [65, "Coffee and hang out"],
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
  startMinute = 0,
): Date {
  const start = new Date(eventDate);
  start.setHours(startHour, startMinute, 0, 0);
  return new Date(start.getTime() + offsetMinutes * 60_000);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
