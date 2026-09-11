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
    if (match?.[1]) {
      await db.event.updateMany({
        where: {
          id: match[1],
          OR: [{ ownerId: user.id }, { ownerId: null }],
        },
        data: { ownerId: user.id, published: true },
      });
    }
  }

  redirect(next);
}
