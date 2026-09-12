import { ClubForm } from "@/components/club-form";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Start a club" };

export default async function NewClubPage() {
  await requireUser("/clubs/new");

  return (
    <div className="px-4 py-6">
      <h1 className="font-display text-2xl text-ink">Start a club</h1>
      <p className="mt-2 mb-8 text-sm text-ink-soft">
        A club is a group that hosts nights. You&rsquo;ll be its owner; anyone
        can join, and you can make members admins so they can post nights too.
      </p>
      <ClubForm />
    </div>
  );
}
