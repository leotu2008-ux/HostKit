import type {
  EventType,
  EventVisibility,
  RsvpStatus,
  TicketType,
} from "@/generated/prisma/enums";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";
import { schoolFor } from "@/lib/schools";

export type ApiSchool = { domain: string; name: string; short: string; city: string | null };

export function serializeSchool(domain: string | null | undefined): ApiSchool | null {
  const school = schoolFor(domain);
  return school
    ? { domain: school.domain, name: school.name, short: school.short, city: school.city }
    : null;
}

export function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  schoolDomain: string | null;
  classYear: number | null;
  bio: string | null;
  imageUrl?: string | null;
  phone?: string | null;
  phoneVerifiedAt?: Date | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    school: serializeSchool(user.schoolDomain),
    classYear: user.classYear,
    bio: user.bio,
    imageUrl: user.imageUrl ?? null,
    phone: user.phone ?? null,
    phoneVerified: Boolean(user.phone && user.phoneVerifiedAt),
  };
}

/** The fields the API reads from an event row, so callers can pass any
 *  Prisma query that selects at least these. */
type EventRow = {
  id: string;
  title: string;
  type: EventType;
  description: string | null;
  vibe: string | null;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  date: Date | null;
  durationHours: number;
  guestCount: number;
  ticketType: TicketType;
  ticketPriceCents: number;
  visibility: EventVisibility;
  published: boolean;
  ownerId: string | null;
  schoolDomain: string | null;
  coverUrl?: string | null;
  requiresApproval?: boolean;
  owner?: { name: string } | null;
};

export type RegistrationState = "none" | "going" | "pending" | "waitlisted";

export type ApiEvent = {
  id: string;
  title: string;
  type: EventType;
  typeLabel: string;
  description: string | null;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /**
   * The start as the web app stores it: the host's wall-clock time encoded as
   * UTC. Clients should format it in UTC so a 7:30 PM night reads 7:30 PM on
   * every device, matching the website.
   */
  startsAt: string | null;
  durationHours: number;
  capacity: number;
  going: number;
  ticketType: TicketType;
  ticketPriceCents: number;
  visibility: EventVisibility;
  published: boolean;
  hostName: string | null;
  /** The host's school, when the host is a student. Surfacing only — anyone
   *  can attend. */
  school: ApiSchool | null;
  /** True when this request may manage the event: the owner, or the device
   *  that drafted it and hasn't signed in yet. */
  isOwner: boolean;
  /** True when the signed-in account is registered as attending. */
  registered: boolean;
  /** Going, asked (pending), or waitlisted — the fuller version of `registered`. */
  registration: RegistrationState;
  /** Registrations wait for the host's approval. */
  requiresApproval: boolean;
  /** A photo the host uploaded; null means draw the cover from the id. */
  coverUrl: string | null;
  webPath: string;
};

export function serializeEvent(
  event: EventRow,
  going: number,
  canManage: boolean,
  registration: RegistrationState | boolean = "none",
): ApiEvent {
  const state: RegistrationState =
    typeof registration === "boolean" ? (registration ? "going" : "none") : registration;
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    typeLabel: EVENT_TYPE_LABEL[event.type],
    description: event.description ?? event.vibe ?? null,
    city: event.city,
    address: event.address,
    lat: event.lat,
    lng: event.lng,
    startsAt: event.date ? event.date.toISOString() : null,
    durationHours: event.durationHours,
    capacity: event.guestCount,
    going,
    ticketType: event.ticketType,
    ticketPriceCents: event.ticketPriceCents,
    visibility: event.visibility,
    published: event.published,
    hostName: event.owner?.name ?? null,
    school: serializeSchool(event.schoolDomain),
    isOwner: canManage,
    registered: state === "going",
    registration: state,
    requiresApproval: event.requiresApproval ?? false,
    coverUrl: event.coverUrl ?? null,
    webPath: `/e/${event.id}`,
  };
}

export type ApiGuest = {
  id: string;
  name: string;
  email: string | null;
  /** The registrant's verified number, when their account has one. */
  phone: string | null;
  status: RsvpStatus;
  plusOnes: number;
  checkedInAt: string | null;
};

/** Selects the registrant's verified phone alongside a guest query. */
export const guestPhone = {
  user: { select: { phone: true, phoneVerifiedAt: true } },
};

export function verifiedPhone(user?: { phone: string | null; phoneVerifiedAt: Date | null } | null) {
  return user?.phone && user.phoneVerifiedAt ? user.phone : null;
}

export function serializeGuest(guest: {
  id: string;
  name: string;
  email: string | null;
  rsvpStatus: RsvpStatus;
  plusOnes: number;
  checkedInAt: Date | null;
  user?: { phone: string | null; phoneVerifiedAt: Date | null } | null;
}): ApiGuest {
  return {
    id: guest.id,
    name: guest.name,
    email: guest.email,
    phone: verifiedPhone(guest.user),
    status: guest.rsvpStatus,
    plusOnes: guest.plusOnes,
    checkedInAt: guest.checkedInAt ? guest.checkedInAt.toISOString() : null,
  };
}

/** Counts attending guests alongside an event query. */
export const goingCount = {
  _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" as const } } } },
};
