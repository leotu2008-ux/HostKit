import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { claimDraftsForUser } from "@/lib/actions/claim";
import { safeNextPath } from "@/lib/listing";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  await claimDraftsForUser(user.id);

  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  if (url.searchParams.get("publish") === "1") {
    const match = next.match(/^\/events\/([^/?#]+)/);
    if (match?.[1]) {
      await db.event.updateMany({
        where: {
          id: match[1],
          OR: [{ ownerId: user.id }, { ownerId: null }],
        },
        data: { ownerId: user.id, claimToken: null, published: true },
      });
    }
  }

  redirect(next);
}
