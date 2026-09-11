import { requireUser } from "@/lib/session";
import { ClubForm } from "@/components/club-form";

export const metadata = { title: "Start a club" };

export default async function NewClubPage() {
  await requireUser("/clubs/new");
  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">Start a club page</h1>
      <p className="mt-1 mb-8 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        A page people follow. Post events as the club and everyone following hears about them. Students’ clubs
        show up at their school first.
      </p>
      <ClubForm />
    </div>
  );
}
