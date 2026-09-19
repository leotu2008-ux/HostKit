import { EventIntakeForm } from "@/components/event-intake-form";
import { currentProfile, getCurrentUser } from "@/lib/session";
import { clubsFor } from "@/lib/clubs";

export const metadata = { title: "Create event" };

export default async function NewEventPage() {
  const user = await getCurrentUser();
  const profile = user ? await currentProfile() : null;
  const clubs = user ? (await clubsFor(user.id)).map((c) => ({ id: c.id, name: c.name })) : [];

  return (
    <div className="px-4 py-6 md:py-4">
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">
        Create event
      </h1>
      <p className="mt-1 mb-8 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        Name, time, place, tickets. You can do this before you have an account —
        publishing is the step that needs a sign-in.
      </p>
      <EventIntakeForm
        signedIn={Boolean(user)}
        clubs={clubs}
        hasSchool={Boolean(profile?.schoolDomain)}
      />
    </div>
  );
}
