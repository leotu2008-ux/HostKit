import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { claimDraftsForUser } from "@/lib/actions/claim";
import { safeNextPath } from "@/lib/listing";

export default async function ClaimDraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; publish?: string }>;
}) {
  const user = await requireUser();
  await claimDraftsForUser(user.id);

  const query = await searchParams;
  const next = safeNextPath(query.next);
  if (query.publish === "1") {
    const match = next.match(/^\/events\/([^/?#]+)/);
    // claimDraftsForUser has already attached this browser's drafts, so only
    // an event this host now owns can be published here — never someone
    // else's unclaimed draft.
    if (match?.[1]) {
      await db.event.updateMany({
        where: { id: match[1], ownerId: user.id },
        data: { published: true },
      });
    }
  }

  redirect(next);
}
