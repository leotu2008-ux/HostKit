import type { RsvpStatus } from "@/generated/prisma/enums";

/**
 * Who a blast goes to. Segments are by RSVP status; only rows with an email
 * can receive anything, and registrations always have one.
 */
export const SEGMENTS = {
  going: "Going",
  pending: "Haven't replied",
  everyone: "Everyone on the list",
} as const;

export type Segment = keyof typeof SEGMENTS;

export const SEGMENT_KEYS = Object.keys(SEGMENTS) as Segment[];

export function isSegment(value: unknown): value is Segment {
  return typeof value === "string" && value in SEGMENTS;
}

export type Recipient = { name: string; email: string };

export function recipientsFor(
  segment: Segment,
  guests: Array<{ name: string; email: string | null; rsvpStatus: RsvpStatus }>,
): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const guest of guests) {
    if (!guest.email) continue;
    const wanted =
      segment === "everyone"
        ? guest.rsvpStatus !== "DECLINED"
        : segment === "going"
          ? guest.rsvpStatus === "ATTENDING"
          : guest.rsvpStatus === "INVITED";
    if (!wanted) continue;
    const email = guest.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ name: guest.name, email });
  }
  return out;
}

/** Fills `{name}` in a body so each guest gets their own greeting. */
export function personalize(body: string, name: string): string {
  return body.replaceAll("{name}", name.split(/\s+/)[0] || name);
}
