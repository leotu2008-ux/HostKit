import type {
  CollaboratorKind,
  CollaboratorStatus,
  InquiryStatus,
  ListingCategory,
  TaskStatus,
} from "@/generated/prisma/enums";
import { CHASE_AFTER_DAYS, goneQuiet, quietContacts } from "@/lib/chase";
import { daysBetween, daysUntil, describeCountdown } from "@/lib/plan";

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

export type BriefingUrgency = "now" | "soon";

export type BriefingKind =
  | "task_overdue"
  | "task_due"
  | "outreach_quiet"
  | "outreach_unsent"
  | "venue_missing"
  | "event_soon";

export type BriefingAction =
  | { type: "complete_task"; taskId: string; label: "Mark done" }
  | { type: "open_outreach"; label: string }
  | { type: "find_venues"; label: "Find venues" }
  | { type: "open_runsheet"; label: "Open run sheet" }
  | { type: "open_plan"; label: "Open the plan" };

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

export type BriefingInput = {
  tasks: BriefingTask[];
  inquiries: BriefingInquiry[];
  collaborators: BriefingCollaborator[];
  now: Date;
};

export type BriefingEvent = { id: string; title: string; date: Date | null };

/** Fixed tiebreak order once urgency is equal. */
const KIND_RANK: Record<BriefingKind, number> = {
  event_soon: 0,
  task_overdue: 1,
  task_due: 2,
  venue_missing: 3,
  outreach_quiet: 4,
  outreach_unsent: 5,
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

  const days = daysUntil(event.date, now);
  const urgency: BriefingUrgency = days !== null && days <= 30 ? "now" : "soon";
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
  const days = daysUntil(event.date, now);
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

export function briefingFor(event: BriefingEvent, input: BriefingInput): Briefing {
  const items: BriefingItem[] = [
    ...taskItems(input.tasks, input.now),
    ...inquiryItems(input.inquiries, event, input.now),
    ...collaboratorItems(input.collaborators, input.now),
  ];

  const venueMissing = venueMissingItem(event, input.inquiries, input.collaborators, input.now);
  if (venueMissing) items.push(venueMissing);

  const eventSoon = eventSoonItem(event, input.now);
  if (eventSoon) items.push(eventSoon);

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
