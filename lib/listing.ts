import type { EventVisibility, TicketType } from "@/generated/prisma/enums";

export const VISIBILITY_LABEL: Record<EventVisibility, string> = {
  PUBLIC: "Public on Discover",
  UNLISTED: "Unlisted link",
  PRIVATE: "Private",
};

export const TICKET_LABEL: Record<TicketType, string> = {
  FREE: "Free",
  PAID: "Paid tickets",
};

export function isDiscoverable(event: {
  published: boolean;
  visibility: EventVisibility;
}): boolean {
  return event.published && event.visibility === "PUBLIC";
}

export function isPublicPageVisible(event: {
  published: boolean;
  visibility: EventVisibility;
}): boolean {
  return event.published && event.visibility !== "PRIVATE";
}

export function safeNextPath(raw: unknown, fallback = "/events"): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return fallback;
  }
  return value;
}
