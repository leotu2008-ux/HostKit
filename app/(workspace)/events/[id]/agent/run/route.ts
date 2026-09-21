import { db } from "@/lib/db";
import { apiError } from "@/lib/api/http";
import { canAccessEvent, getCurrentUser } from "@/lib/session";
import { clientIp } from "@/lib/rate-limit";
import { startAgentRun } from "@/lib/agent/trigger";

/**
 * The sidebar's "Run again" / "Try again", as a plain form POST.
 *
 * Why a Route Handler and not a Server Action: an action's timeout is the
 * *page's* maxDuration (the maxDuration route segment config docs say so),
 * and components/workspace-sidebar.tsx is rendered by the workspace layout on
 * all six tabs. An action there would inherit whichever page the host was
 * on — at the platform default, on five of the six — while runAgent budgets
 * 45s inside `after()`, so the invocation would be killed mid-run and leave
 * the AgentRun row RUNNING and the status line stuck on "Working on this
 * now…". A handler carries its own ceiling, wherever it's posted from.
 *
 * `<form method="post" action={…}>` needs no client JS, so this works on the
 * first paint and without hydration.
 */

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // requireEvent is the page-side door and it redirects — a 307 to /signin is
  // not an answer to a POST. So this uses the two pieces requireEvent is
  // built from, the same way lib/api/http.ts's manageableEvent gives the v1
  // handlers a check that returns instead of redirecting.
  const user = await getCurrentUser();
  const event = await db.event.findFirst({ where: { id } });
  // One answer for "no such event" and "not yours", so an id can't be
  // confirmed by asking.
  if (!event || !(await canAccessEvent(event, user?.id ?? null))) {
    return apiError("Not allowed.", 403);
  }

  const ipKey = event.ownerId ? null : clientIp(request.headers);
  await startAgentRun(event.id, ipKey);

  // 303, not Next's redirect(): that throws a 307, which would re-send this
  // POST to the page it lands on. See Other is what turns a form POST into
  // the browser's GET of the page the host was already looking at.
  return new Response(null, {
    status: 303,
    headers: { Location: backTo(request, event.id), "Cache-Control": "no-store" },
  });
}

/** The tab the host pressed from, or Overview. Only a same-origin path is
 *  honoured — a Referer is attacker-settable, and echoing one into Location
 *  would make this an open redirect. */
function backTo(request: Request, eventId: string): string {
  const fallback = `/events/${eventId}`;
  const referer = request.headers.get("referer");
  if (!referer) return fallback;
  try {
    const target = new URL(referer);
    const here = new URL(request.url);
    if (target.origin !== here.origin) return fallback;
    return `${target.pathname}${target.search}`;
  } catch {
    return fallback;
  }
}
