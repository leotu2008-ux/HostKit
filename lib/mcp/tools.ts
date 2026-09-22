import { z } from "zod";

/**
 * What Hosty offers an agent.
 *
 * Deliberately a client of the existing v1 API rather than of the database.
 * Every route already checks who is asking and what they may see, and a second
 * path into the data would be a second place for that to go wrong — silently,
 * and in the direction of showing someone else's guest list.
 *
 * Read-only for now. The plan's autonomy decision was drafts only, a human
 * presses every button, and nothing should write from here until there is an
 * audit log to write alongside it. The write tools are sketched in the README
 * so the shape is agreed before the capability exists.
 *
 * Tool definitions live apart from the transport so they can be tested without
 * standing a server up.
 */

export type ToolContext = {
  /** Where Hosty is, e.g. https://tryhosty.app */
  baseUrl: string;
  /** A bearer token from POST /api/v1/auth/token. */
  token: string;
  fetchImpl?: typeof fetch;
};

export class HostyApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HostyApiError";
  }
}

/** One GET against the API, with the token attached and errors made legible. */
export async function apiGet<T>(ctx: ToolContext, path: string): Promise<T> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const url = `${ctx.baseUrl.replace(/\/+$/, "")}${path}`;
  const response = await doFetch(url, {
    headers: { authorization: `Bearer ${ctx.token}`, accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // 401 is nearly always a stale token, and saying so saves a support round trip.
    const hint =
      response.status === 401
        ? "The token was rejected. Tokens expire and a password reset invalidates them; get a new one from POST /api/v1/auth/token."
        : body.slice(0, 200);
    throw new HostyApiError(response.status, `Hosty answered ${response.status}. ${hint}`);
  }
  return (await response.json()) as T;
}

/** Query string from defined values only, so optional args stay absent. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const pairs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (pairs.length === 0) return "";
  return `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")}`;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const listEventsSchema = z.object({});

export const getEventSchema = z.object({
  eventId: z.string().min(1).describe("The event's id, as returned by list_events."),
});

export const listGuestsSchema = z.object({
  eventId: z.string().min(1).describe("The event's id."),
});

export const campusSchema = z.object({
  school: z
    .string()
    .min(1)
    .optional()
    .describe("A school's email domain, e.g. babson.edu. Defaults to the signed-in student's own."),
});

export const discoverSchema = z.object({
  city: z.string().optional().describe("Filter to a city, e.g. \"Boston, MA\"."),
  q: z.string().optional().describe("Search titles, hosts and places."),
});

export type ToolName =
  | "list_events"
  | "get_event"
  | "list_guests"
  | "campus_events"
  | "discover_events";

export type ToolSpec = {
  name: ToolName;
  title: string;
  description: string;
  schema: z.ZodType;
  /** Reads only. Kept explicit so a write tool cannot be added by accident. */
  readOnly: true;
  run: (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
};

export const TOOLS: ToolSpec[] = [
  {
    name: "list_events",
    title: "List the events you host",
    description:
      "Every event this account hosts or helps run, soonest first, with dates, cities, capacity and how many have said yes. Start here to find an event's id.",
    schema: listEventsSchema,
    readOnly: true,
    run: (ctx) => apiGet(ctx, "/api/v1/events"),
  },
  {
    name: "get_event",
    title: "Get one event",
    description:
      "Everything about a single event: when and where, capacity, whether it is published, and the guest counts.",
    schema: getEventSchema,
    readOnly: true,
    run: (ctx, args) => apiGet(ctx, `/api/v1/events/${encodeURIComponent(String(args.eventId))}`),
  },
  {
    name: "list_guests",
    title: "List an event's guests",
    description:
      "The guest list with each person's RSVP and whether they came through the door, plus a summary of how many are going, pending, waitlisted and checked in. The RSVP and the check-in are separate facts: someone can have said yes and not turned up, or turned up without ever replying.",
    schema: listGuestsSchema,
    readOnly: true,
    run: (ctx, args) =>
      apiGet(ctx, `/api/v1/events/${encodeURIComponent(String(args.eventId))}/guests`),
  },
  {
    name: "campus_events",
    title: "What is on at a school",
    description:
      "Official campus events from a school's own calendars, soonest first. Useful for seeing what a night is already up against before choosing one.",
    schema: campusSchema,
    readOnly: true,
    run: (ctx, args) => apiGet(ctx, `/api/v1/campus${query({ school: args.school as string })}`),
  },
  {
    name: "discover_events",
    title: "Find public events",
    description: "Public, upcoming events across Hosty, optionally filtered by city or search term.",
    schema: discoverSchema,
    readOnly: true,
    run: (ctx, args) =>
      apiGet(ctx, `/api/v1/discover${query({ city: args.city as string, q: args.q as string })}`),
  },
];

export function toolByName(name: string): ToolSpec | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
