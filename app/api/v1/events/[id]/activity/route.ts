import { db } from "@/lib/db";
import { apiError, apiUser, json } from "@/lib/api/http";
import { requestOwnsDraft } from "@/lib/api/drafts";
import { canAccessEvent, getCurrentUser } from "@/lib/session";
import { loadActivity, loadAgentStatus } from "@/lib/activity";
import { toFeedRow } from "@/lib/activity-format";

/**
 * What's happening on this event: the feed plus the agent's current status,
 * in one poll. `after`/`limit` let the poller ask for only what it hasn't
 * seen (see components/activity-feed.tsx).
 *
 * Two proofs, because two clients poll this: the iOS app sends its drafts
 * header (requestOwnsDraft), the browser holds the httpOnly cookie
 * (canAccessEvent reads it). Every other v1 route only ever sees the first.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = (await apiUser(request)) ?? (await getCurrentUser());

  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      claimToken: true,
      clubId: true,
      title: true,
      kind: true,
      type: true,
      date: true,
      durationHours: true,
      city: true,
      guestCount: true,
      budgetTotalCents: true,
      vibe: true,
      description: true,
    },
  });
  if (!event) return apiError("Not found.", 404);

  const allowed =
    requestOwnsDraft(request, event) || (await canAccessEvent(event, viewer?.id ?? null));
  if (!allowed) return apiError(viewer ? "Not found." : "Sign in first.", viewer ? 404 : 401);

  const url = new URL(request.url);
  const rawAfter = url.searchParams.get("after");
  const after = rawAfter ? new Date(rawAfter) : null;
  const validAfter = after && !Number.isNaN(after.getTime()) ? after : null;

  const rawLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;

  const [rows, agent] = await Promise.all([
    loadActivity(event.id, { after: validAfter, limit }),
    loadAgentStatus(event),
  ]);

  return json({ rows: rows.map(toFeedRow), agent });
}
