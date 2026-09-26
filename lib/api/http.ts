import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/api/token";
import { requestOwnsDraft } from "@/lib/api/drafts";
import { hasDashboardAccess } from "@/lib/access";
import { agentRevokedAt, bearerRevoked } from "@/lib/agent-tokens";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function apiError(message: string, status: number) {
  return json({ error: message }, status);
}

/** Parses a JSON body, or null when there isn't a valid one. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const apiUserSelect = {
  id: true,
  name: true,
  email: true,
  schoolDomain: true,
  classYear: true,
  bio: true,
  company: true,
  xHandle: true,
  linkedinHandle: true,
  instagramHandle: true,
  imageUrl: true,
  phone: true,
  phoneVerifiedAt: true,
  emailVerifiedAt: true,
  approvedAt: true,
  sessionVersion: true,
} as const;

/**
 * The account behind a bearer token, including someone signed in who has not
 * been approved. Null when the header is missing, invalid, or stale.
 * `apiUser` still drops unapproved accounts; this exists so a route can
 * answer 403 instead of pretending they are anonymous.
 */
export async function apiBearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const payload = verifyToken(match[1]);
  if (!payload) return null;
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: apiUserSelect,
  });
  // A password reset bumps the version; tokens issued before it are out.
  if (!user || user.sessionVersion !== payload.v) return null;
  // Settings → Revoke agent access records a cutoff. Tokens issued at or
  // before it stop working, including ones that are still inside 30 days.
  // Every bearer path goes through here, including POST /api/v1/events.
  if (bearerRevoked(payload, await agentRevokedAt(user.id))) return null;
  return user;
}

/** The user behind a `Authorization: Bearer` token who can use the host app, or null. */
export async function apiUser(request: Request) {
  const user = await apiBearer(request);
  if (!user || !hasDashboardAccess(user)) return null;
  return user;
}

export type ApiUserRow = NonNullable<Awaited<ReturnType<typeof apiUser>>>;

/**
 * An event this request may manage: one the signed-in user owns, or a draft
 * the device made and still holds the token for. Null otherwise, so callers
 * answer 404 and never confirm that someone else's event exists.
 */
export async function manageableEvent(
  request: Request,
  eventId: string,
  userId: string | null,
) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  if (userId && event.ownerId === userId) return event;
  if (requestOwnsDraft(request, event)) return event;
  // Admins of the club an event was posted as run it too.
  if (userId && event.clubId && (await isClubMember(userId, event.clubId))) return event;
  return null;
}

export async function isClubMember(userId: string, clubId: string): Promise<boolean> {
  const row = await db.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId } },
    select: { role: true },
  });
  return row !== null;
}
