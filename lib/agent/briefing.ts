import type {
  CollaboratorKind,
  CollaboratorStatus,
  EventStatus,
  EventType,
  InquiryStatus,
  ListingCategory,
  RsvpStatus,
  TaskStatus,
} from "@/generated/prisma/enums";
import { recipientsFor, type BlastDraftKind } from "@/lib/blasts";
import { schoolTimeZone } from "@/lib/campus/sources";
import { wallClock } from "@/lib/campus/time";
import { CHASE_AFTER_DAYS, goneQuiet, quietContacts } from "@/lib/chase";
import { daysBetween, daysUntil, describeCountdown } from "@/lib/plan";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";

/**
 * The single source of truth for "what needs you today" on one event.
 *
 * Pure and synchronous: it takes the rows a caller already loaded and turns
 * them into a sorted, capped list of cards, each with exactly one action.
 * Both the daily cron (lib/agent/digest.ts) and, later, the agent panel call
 * this — neither computes anything of its own, so they can never disagree.
 *
 * Timezone caveat: every "today"/"due" judgment here rides on lib/plan.ts's
 * startOfDay, which reads the server's local clock, and the cron that calls
 * this (app/api/cron/agent-briefing) runs on Vercel, which is UTC. A host
 * east of UTC sees "today" tip into "tomorrow" hours before their own
 * midnight does, and the fixed 13:00 UTC schedule (9am ET) means the digest
 * lands mid-morning for the coasts it was built for and later or earlier
 * everywhere else. Per-host timezones are a known follow-up; v1 treats
 * "today" as a single US day boundary for every host.
 */

export const DUE_SOON_DAYS = 3;
export const EVENT_SOON_DAYS = 7;
export const MAX_ITEMS = 8;
/** Inside this many days out, a missing venue escalates from "soon" to "now". */
export const VENUE_URGENT_DAYS = 30;
/** "About a week out": the nudge to the unreplied shows from this many days
 *  before the night until the day before takes over with the reminder. */
export const NUDGE_DAYS = 7;

export type BriefingUrgency = "now" | "soon";

export type BriefingKind =
  | "task_overdue"
  | "task_due"
  | "outreach_quiet"
  | "outreach_unsent"
  | "venue_missing"
  | "event_soon"
  | "guests_unreplied"
  | "guests_remind"
  | "type_check"
  | "night_competition";

export type BriefingAction =
  | { type: "complete_task"; taskId: string; label: "Mark done" }
  | { type: "open_outreach"; label: string }
  | { type: "find_venues"; label: "Find venues" }
  | { type: "open_runsheet"; label: "Open run sheet" }
  | { type: "open_plan"; label: "Open the plan" }
  | { type: "open_blast"; draft: BlastDraftKind; label: "Nudge them" | "Write reminder" }
  | { type: "set_type"; eventType: EventType; label: string }
  | { type: "open_brief"; label: "Review the date" };

export type BriefingItem = {
  id: string; // `${kind}:${refId}`
  kind: BriefingKind;
  urgency: BriefingUrgency;
  title: string;
  detail: string;
  action: BriefingAction;
};

export type Briefing = {
  eventId: string;
  items: BriefingItem[];
  counts: { now: number; soon: number; total: number };
  /** "" when there is nothing to say. */
  headline: string;
};

export type BriefingTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  status: TaskStatus;
  category: ListingCategory | null;
};

export type BriefingInquiry = {
  id: string;
  name: string;
  status: InquiryStatus;
  toEmail: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  /** The listing's category — carried so venueMissingItem can tell a booked
   *  venue apart from a booked caterer. */
  category: ListingCategory | null;
};

export type BriefingCollaborator = {
  id: string;
  kind: CollaboratorKind;
  name: string;
  email: string | null;
  status: CollaboratorStatus;
  sentAt: Date | null;
  /** Optional so a caller that predates Milestone D (and every existing test
   *  fixture) can omit it; treated as null when absent. */
  respondedAt?: Date | null;
};

export type BriefingGuest = { name: string; email: string | null; rsvpStatus: RsvpStatus };

export type BriefingBlast = { segment: string; sentAt: Date };

export type BriefingInput = {
  tasks: BriefingTask[];
  inquiries: BriefingInquiry[];
  collaborators: BriefingCollaborator[];
  /** Optional, like BriefingCollaborator.respondedAt, so callers and fixtures
   *  that predate the guest reminders can omit them. */
  guests?: BriefingGuest[];
  blasts?: BriefingBlast[];
  /** The type Jev guessed but wasn't sure of (lib/brief-classify.ts's
   *  typeCheckFrom), when it's worth asking the host about. */
  typeCheck?: EventType | null;
  /** Same-night events Jev judged as competition, still on that night
   *  (lib/night-competition.ts's loadCompetitors). */
  competitors?: Array<{ id: string; title: string; pull: number }>;
  now: Date;
};

export type BriefingEvent = {
  id: string;
  title: string;
  date: Date | null;
  status?: EventStatus;
  schoolDomain?: string | null;
};

/** Fixed tiebreak order once urgency is equal. */
const KIND_RANK: Record<BriefingKind, number> = {
  event_soon: 0,
  guests_remind: 1,
  task_overdue: 2,
  task_due: 3,
  venue_missing: 4,
  guests_unreplied: 5,
  outreach_quiet: 6,
  outreach_unsent: 7,
  type_check: 8,
  night_competition: 9,
};

const DAY_MS = 86_400_000;

function taskItems(tasks: BriefingTask[], now: Date): BriefingItem[] {
  const items: BriefingItem[] = [];
  for (const task of tasks) {
    if (task.status !== "TODO" || !task.dueDate) continue;
    const days = daysUntil(task.dueDate, now);
    if (days === null || days > DUE_SOON_DAYS) continue;

    items.push({
      id: `${days < 0 ? "task_overdue" : "task_due"}:${task.id}`,
      kind: days < 0 ? "task_overdue" : "task_due",
      urgency: days <= 0 ? "now" : "soon",
      title: task.title,
      detail: `Due ${describeCountdown(days)}`,
      action: { type: "complete_task", taskId: task.id, label: "Mark done" },
    });
  }
  return items;
}

function inquiryItems(inquiries: BriefingInquiry[], event: BriefingEvent, now: Date): BriefingItem[] {
  const items: BriefingItem[] = [];

  // goneQuiet owns the definition of "quiet" — mirrored here only for the
  // "twice as long" escalation, using the same raw-timestamp cutoff it uses
  // internally rather than a day-rounded one, so the two never disagree at
  // the boundary.
  for (const quiet of goneQuiet(inquiries, now)) {
    const veryQuietCutoff = now.getTime() - 2 * CHASE_AFTER_DAYS * DAY_MS;
    const urgency: BriefingUrgency = quiet.sentAt!.getTime() <= veryQuietCutoff ? "now" : "soon";
    items.push({
      id: `outreach_quiet:${quiet.id}`,
      kind: "outreach_quiet",
      urgency,
      title: quiet.name,
      detail: `No reply in ${daysBetween(quiet.sentAt!, now)} days`,
      action: { type: "open_outreach", label: "Follow up" },
    });
  }

  for (const inquiry of inquiries) {
    if (inquiry.status !== "DRAFT" || !inquiry.toEmail || !event.date) continue;
    items.push({
      id: `outreach_unsent:${inquiry.id}`,
      kind: "outreach_unsent",
      urgency: "soon",
      title: inquiry.name,
      detail: "Drafted, not sent yet",
      action: { type: "open_outreach", label: "Send message" },
    });
  }

  return items;
}

function collaboratorItems(collaborators: BriefingCollaborator[], now: Date): BriefingItem[] {
  const items: BriefingItem[] = [];
  // quietContacts owns the definition of "quiet" for a collaborator, the same
  // way goneQuiet owns it for an inquiry above — computed once over the full
  // list so the per-row loop below only has to ask "is this id in the set".
  const quietIds = new Set(
    quietContacts(
      collaborators.map((c) => ({ ...c, respondedAt: c.respondedAt ?? null })),
      now,
    ).map((c) => c.id),
  );

  for (const collaborator of collaborators) {
    if (collaborator.status !== "PENDING" || !collaborator.email) continue;

    if (!collaborator.sentAt) {
      items.push({
        id: `outreach_unsent:${collaborator.id}`,
        kind: "outreach_unsent",
        urgency: "soon",
        title: collaborator.name,
        detail: "Drafted, not sent yet",
        action: { type: "open_outreach", label: "Send message" },
      });
      continue;
    }

    if (quietIds.has(collaborator.id)) {
      items.push({
        id: `outreach_quiet:${collaborator.id}`,
        kind: "outreach_quiet",
        urgency: "soon",
        title: collaborator.name,
        detail: `No reply in ${daysBetween(collaborator.sentAt, now)} days`,
        action: { type: "open_outreach", label: "Follow up" },
      });
    }
  }
  return items;
}

function venueMissingItem(
  event: BriefingEvent,
  inquiries: BriefingInquiry[],
  collaborators: BriefingCollaborator[],
  now: Date,
): BriefingItem | null {
  // A venue counts as covered either way it can arrive: through the agent's
  // own venue search (Milestone C), which lands as an EventCollaborator, or
  // through the older path of booking a VENUE-category catalog Inquiry
  // straight to BOOKED (lib/actions/inquiries.ts:149-175), which never
  // touches EventCollaborator at all. Missing either half of this check
  // would nag a host who has, in fact, already booked their venue.
  const hasVenue =
    collaborators.some((c) => c.kind === "VENUE") ||
    inquiries.some((i) => i.category === "VENUE" && i.status === "BOOKED");
  if (hasVenue) return null;

  const days = nightIn(event, now);
  const urgency: BriefingUrgency = days !== null && days <= VENUE_URGENT_DAYS ? "now" : "soon";
  return {
    id: `venue_missing:${event.id}`,
    kind: "venue_missing",
    urgency,
    title: "No venue yet",
    detail: "Nothing booked for the space",
    action: { type: "find_venues", label: "Find venues" },
  };
}

function eventSoonItem(event: BriefingEvent, now: Date): BriefingItem | null {
  const days = nightIn(event, now);
  if (days === null || days < 0 || days > EVENT_SOON_DAYS) return null;
  return {
    id: `event_soon:${event.id}`,
    kind: "event_soon",
    urgency: days <= 2 ? "now" : "soon",
    title: `${event.title} is coming up`,
    detail: describeCountdown(days),
    action: { type: "open_runsheet", label: "Open run sheet" },
  };
}

/**
 * Calendar days from `at` to the night. `date` is the host's wall-clock time
 * encoded as UTC, so the day is read off the clock at the event's school.
 */
export function nightIn(event: BriefingEvent, at: Date): number | null {
  if (!event.date) return null;
  const today = wallClock(at, schoolTimeZone(event.schoolDomain));
  return Math.floor(event.date.getTime() / DAY_MS) - Math.floor(today.getTime() / DAY_MS);
}

/**
 * The two before-the-night reminders. Hosty never sends them: each opens a
 * drafted blast the host edits and sends. About a week out, the invited who
 * haven't replied; the day before, the guests going (never the waitlist).
 * Counts are the people the blast would actually reach (an email, once each),
 * and an item goes away once a blast to that segment has gone out inside its
 * window.
 */
function guestItems(event: BriefingEvent, input: BriefingInput): BriefingItem[] {
  const days = nightIn(event, input.now);
  if (days === null || days < 1 || days > NUDGE_DAYS || event.status === "CANCELLED") return [];
  const guests = input.guests ?? [];
  const sentWithin = (segment: string, window: number) =>
    (input.blasts ?? []).some((b) => b.segment === segment && (nightIn(event, b.sentAt) ?? Infinity) <= window);

  if (days === 1) {
    const n = recipientsFor("going", guests).length;
    if (n === 0 || sentWithin("going", 1)) return [];
    return [
      {
        id: `guests_remind:${event.id}`,
        kind: "guests_remind",
        urgency: "now",
        title: `Remind your ${n} ${n === 1 ? "guest" : "guests"}`,
        detail: "The night is tomorrow",
        action: { type: "open_blast", draft: "reminder", label: "Write reminder" },
      },
    ];
  }

  const n = recipientsFor("pending", guests).length;
  if (n === 0 || sentWithin("pending", NUDGE_DAYS)) return [];
  return [
    {
      id: `guests_unreplied:${event.id}`,
      kind: "guests_unreplied",
      urgency: "soon",
      title: `${n} ${n === 1 ? "hasn't" : "haven't"} replied`,
      detail: `The night is ${describeCountdown(days)}`,
      action: { type: "open_blast", draft: "nudge", label: "Nudge them" },
    },
  ];
}

/** "Is this a dinner party?", with the one press that settles it. The
 *  words come from EVENT_TYPE_LABEL; Jev only chose which label. */
function typeCheckItem(event: BriefingEvent, type: EventType | null | undefined): BriefingItem | null {
  if (!type) return null;
  const label = EVENT_TYPE_LABEL[type].toLowerCase();
  return {
    id: `type_check:${event.id}`,
    kind: "type_check",
    urgency: "soon",
    title: `Is this a ${label}?`,
    detail: "It's planned as a mixer until you say",
    action: { type: "set_type", eventType: type, label: `Plan it as a ${label}` },
  };
}

/** A competing night's detail line, from the pull level Jev's answer saved
 *  (0–3, see lib/night-competition.ts): it says no more than that level. */
export function pullPhrase(pull: number): string {
  return Math.round(pull) >= 3
    ? "Likely the same crowd; most of yours could be torn between the two"
    : "Likely the same crowd; some of your guests might go there instead";
}

export function briefingFor(event: BriefingEvent, input: BriefingInput): Briefing {
  const items: BriefingItem[] = [
    ...taskItems(input.tasks, input.now),
    ...inquiryItems(input.inquiries, event, input.now),
    ...collaboratorItems(input.collaborators, input.now),
    ...guestItems(event, input),
  ];

  const venueMissing = venueMissingItem(event, input.inquiries, input.collaborators, input.now);
  if (venueMissing) items.push(venueMissing);

  const eventSoon = eventSoonItem(event, input.now);
  if (eventSoon) items.push(eventSoon);

  const typeCheck = typeCheckItem(event, input.typeCheck);
  if (typeCheck) items.push(typeCheck);

  // Only a night still ahead: once it's passed, a clash is history.
  const days = nightIn(event, input.now);
  if (days !== null && days >= 0) {
    for (const competitor of input.competitors ?? []) {
      items.push({
        id: `night_competition:${competitor.id}`,
        kind: "night_competition",
        urgency: "soon",
        title: `Also on that night: ${competitor.title}`,
        detail: pullPhrase(competitor.pull),
        action: { type: "open_brief", label: "Review the date" },
      });
    }
  }

  items.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "now" ? -1 : 1;
    if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
    return a.title.localeCompare(b.title);
  });

  const truncated = items.slice(0, MAX_ITEMS);
  const now = truncated.filter((i) => i.urgency === "now").length;
  const soon = truncated.length - now;

  return {
    eventId: event.id,
    items: truncated,
    counts: { now, soon, total: truncated.length },
    headline: headlineFor(now, soon, truncated.length),
  };
}

function headlineFor(now: number, soon: number, total: number): string {
  if (total === 0) return "";
  if (now === 0) return `Nothing urgent — ${soon} coming up`;
  if (now === 1) return "1 thing needs you today";
  return `${now} things need you today`;
}

/** The say-nothing rule as a function: only worth a notification once
 *  something is actually urgent, not merely upcoming. */
export function worthNotifying(b: Briefing): boolean {
  return b.counts.now > 0;
}

/** first 3 titles · "+N more" */
export function digestNotice(b: Briefing, eventTitle: string): { title: string; body: string } {
  const top = b.items.slice(0, 3).map((i) => i.title);
  const remaining = b.items.length - top.length;
  const body = remaining > 0 ? `${top.join(" · ")} · +${remaining} more` : top.join(" · ");
  return {
    title: b.headline ? `${eventTitle}: ${b.headline}` : eventTitle,
    body,
  };
}

/** True when every run of digits in `text` names a number that was actually
 *  computed, i.e. is present in `allowed`. The model's one guardrail against
 *  inventing a figure that was never handed to it. */
export function numbersAreGrounded(text: string, allowed: number[]): boolean {
  const runs = text.match(/\d+/g) ?? [];
  return runs.every((run) => allowed.includes(Number(run)));
}
