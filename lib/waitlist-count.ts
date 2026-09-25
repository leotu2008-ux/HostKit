import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

/**
 * How many people are on the waitlist, for the line under "Join the
 * waitlist" on the landing page. Only the number ever leaves this module —
 * never a name or an address.
 */

/** Tag on the cached count. A signup expires it so the new number shows at once. */
export const WAITLIST_COUNT_TAG = "waitlist-count";

/** Seconds a page view may reuse the count before it is read again. */
export const WAITLIST_COUNT_REVALIDATE = 60;

function countEntries(): Promise<number> {
  return db.emailListEntry.count();
}

// A thrown query is not cached, so a failed read is retried on the next view
// rather than hiding the line for a minute.
const cachedCount = unstable_cache(countEntries, ["waitlist-count"], {
  revalidate: WAITLIST_COUNT_REVALIDATE,
  tags: [WAITLIST_COUNT_TAG],
});

async function safely(read: () => Promise<number>): Promise<number | null> {
  try {
    return await read();
  } catch (error) {
    console.error("[waitlist] count failed", error);
    return null;
  }
}

/** The cached count, or null when the database can't answer. */
export function getWaitlistCount(): Promise<number | null> {
  return safely(cachedCount);
}

/** A fresh count, straight after a signup. Null when the database can't answer. */
export function readWaitlistCount(): Promise<number | null> {
  return safely(countEntries);
}
