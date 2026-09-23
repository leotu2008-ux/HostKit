import { Landing } from "@/components/landing";
import { hasDashboardAccess } from "@/lib/access";
import { currentProfile } from "@/lib/session";

export const metadata = { title: "Hosty — an agent that plans your event" };

/**
 * "/" is the landing page for everyone, signed in or not.
 *
 * It used to branch: a stranger got the pitch, a signed-in host got a
 * dashboard of their events, their clubs and what was on nearby. That split is
 * gone — the front door is the product's argument, and a host who wants their
 * own events goes to /events, which is what the nav points at.
 *
 * The dashboard it replaced is not lost: it is in git history, and whole on
 * the pre-ai-pivot branch.
 */
export default async function HomePage() {
  const user = await currentProfile();
  return <Landing canCreate={Boolean(user && hasDashboardAccess(user))} />;
}
