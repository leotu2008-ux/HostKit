import { claimMatches, type DraftClaim } from "@/lib/drafts";

/**
 * How a signed-out phone proves it made a draft.
 *
 * The website keeps `{id, token}` pairs in a cookie; the app keeps the same
 * pairs on the device and sends them as `X-HostKit-Drafts: id.token,id.token`.
 * Tokens are hex (see newClaimToken), so "." is a safe separator.
 */
export const DRAFTS_HEADER = "x-hostkit-drafts";

export function parseDraftsHeader(raw: string | null | undefined): DraftClaim[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .flatMap((pair) => {
      const dot = pair.indexOf(".");
      if (dot <= 0 || dot === pair.length - 1) return [];
      return [{ id: pair.slice(0, dot), token: pair.slice(dot + 1) }];
    })
    .slice(0, 20);
}

export function requestDrafts(request: Request): DraftClaim[] {
  return parseDraftsHeader(request.headers.get(DRAFTS_HEADER));
}

/** True when the request carries the token for this unclaimed draft. */
export function requestOwnsDraft(
  request: Request,
  event: { id: string; ownerId: string | null; claimToken: string | null },
): boolean {
  if (event.ownerId !== null) return false;
  return claimMatches(requestDrafts(request), event.id, event.claimToken);
}
