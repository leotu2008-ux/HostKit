import type {
  EventType,
  EventVisibility,
  RsvpStatus,
  TicketType,
} from "@/generated/prisma/enums";
import { EVENT_TYPE_LABEL } from "@/lib/catalog";

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
  owner?: { name: string } | null;
};

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
  /** True when this request may manage the event: the owner, or the device
   *  that drafted it and hasn't signed in yet. */
  isOwner: boolean;
  webPath: string;
};

export function serializeEvent(
  event: EventRow,
  going: number,
  canManage: boolean,
): ApiEvent {
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
    isOwner: canManage,
    webPath: `/e/${event.id}`,
  };
}

export type ApiGuest = {
  id: string;
  name: string;
  email: string | null;
  status: RsvpStatus;
  plusOnes: number;
  checkedInAt: string | null;
};

export function serializeGuest(guest: {
  id: string;
  name: string;
  email: string | null;
  rsvpStatus: RsvpStatus;
  plusOnes: number;
  checkedInAt: Date | null;
}): ApiGuest {
  return {
    id: guest.id,
    name: guest.name,
    email: guest.email,
    status: guest.rsvpStatus,
    plusOnes: guest.plusOnes,
    checkedInAt: guest.checkedInAt ? guest.checkedInAt.toISOString() : null,
  };
}

/** Counts attending guests alongside an event query. */
export const goingCount = {
  _count: { select: { guests: { where: { rsvpStatus: "ATTENDING" as const } } } },
};
