import type { EventVisibility } from "@/generated/prisma/enums";

export const VISIBILITY_LABEL: Record<EventVisibility, string> = {
  PUBLIC: "Public on Discover",
  UNLISTED: "Unlisted link",
  PRIVATE: "Private",
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
  // "/\\evil.test" is "//evil.test" to a browser; control characters can
  // split a header. Only a plain same-site path passes.
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }
  return value;
}
