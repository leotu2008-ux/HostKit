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
  company?: string | null;
  xHandle?: string | null;
  linkedinHandle?: string | null;
  instagramHandle?: string | null;
  imageUrl?: string | null;
  phone?: string | null;
  phoneVerifiedAt?: Date | null;
  showOnGuestLists?: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    school: serializeSchool(user.schoolDomain),
    classYear: user.classYear,
    bio: user.bio,
    company: user.company ?? null,
    /** Bare handles; null when not set. Links: x.com/<h>, linkedin.com/in/<h>, instagram.com/<h>. */
    socials: {
      x: user.xHandle ?? null,
      linkedin: user.linkedinHandle ?? null,
      instagram: user.instagramHandle ?? null,
    },
    imageUrl: user.imageUrl ?? null,
    phone: user.phone ?? null,
    phoneVerified: Boolean(user.phone && user.phoneVerifiedAt),
    showOnGuestLists: user.showOnGuestLists ?? true,
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
  club?: { handle: string; name: string; imageUrl: string | null } | null;
};

export type RegistrationState = "none" | "going" | "pending" | "waitlisted";

/** The club an event was posted as. */
export type ApiEventClub = { handle: string; name: string; imageUrl: string | null; webPath: string };

/** A club page, as the apps list and show it. */
export type ApiClub = {
  id: string;
  handle: string;
  name: string;
  blurb: string | null;
  imageUrl: string | null;
  coverUrl: string | null;
  school: ApiSchool | null;
  city: string | null;
  followers: number;
  isFollowing: boolean;
  canManage: boolean;
  webPath: string;
};

export function serializeClub(
  club: {
    id: string;
    handle: string;
    name: string;
    blurb: string | null;
    imageUrl: string | null;
    coverUrl: string | null;
    schoolDomain: string | null;
    city: string | null;
    _count: { followers: number };
  },
  viewer: { following: Set<string>; managed: Set<string> },
): ApiClub {
  return {
    id: club.id,
    handle: club.handle,
    name: club.name,
    blurb: club.blurb,
    imageUrl: club.imageUrl,
    coverUrl: club.coverUrl,
    school: serializeSchool(club.schoolDomain),
    city: club.city,
    followers: club._count.followers,
    isFollowing: viewer.following.has(club.id),
    canManage: viewer.managed.has(club.id),
    webPath: `/c/${club.handle}`,
  };
}

/** A face on the event page. */
export type ApiAttendee = { id: string; firstName: string; imageUrl: string | null };

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
  /** The first few people going (opted-in account registrations); empty in lists. */
  attendees: ApiAttendee[];
  /** The club this was posted as, when it was. */
  club: ApiEventClub | null;
  /** A photo the host uploaded; null means draw the cover from the id. */
  coverUrl: string | null;
  webPath: string;
  /**
   * Set on events pulled from a school's official calendar (id starts with
   * `campus_`): nobody registers here — `url` is the page to open.
   */
  official?: ApiOfficial | null;
};

export type ApiOfficial = {
  /** The feed it came from: "MIT Events Calendar". */
  source: string;
  /** The event's page on the school's site. */
  url: string;
  allDay: boolean;
  /** Wall-clock end, encoded like `startsAt`; null when the feed has none. */
  endsAt: string | null;
};

export function serializeEvent(
  event: EventRow,
  going: number,
  canManage: boolean,
  registration: RegistrationState | boolean = "none",
  attendees: ApiAttendee[] = [],
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
    attendees,
    club: event.club
      ? { handle: event.club.handle, name: event.club.name, imageUrl: event.club.imageUrl, webPath: `/c/${event.club.handle}` }
      : null,
    coverUrl: event.coverUrl ?? null,
    webPath: `/e/${event.id}`,
    official: null,
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

/** Everything `serializeEvent` reads beyond the event row itself. */
export const eventInclude = {
  owner: { select: { name: true } },
  club: { select: { handle: true, name: true, imageUrl: true } },
  ...goingCount,
};
