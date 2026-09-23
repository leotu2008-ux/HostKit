import { runAgainAction } from "@/lib/actions/run-again";
import { requireEvent } from "@/lib/session";
import { Button, Card, Field, Input } from "@/components/ui";

export const metadata = { title: "Run it again" };

const DAY_MS = 86_400_000;

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, in local time like the rest of the brief
 *  form (see splitStart in lib/when.ts). */
function inputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${d}T${t}`;
}

/** Pick the new date; everything else comes from this event. */
export default async function RunAgainPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/run-again">) {
  const { id } = await params;
  const { error } = await searchParams;
  const { event } = await requireEvent(id);
  const suggested = new Date((event.date ?? new Date()).getTime() + 7 * DAY_MS);

  const errorCode = typeof error === "string" ? error : undefined;

  return (
    <div className="mx-auto max-w-xl space-y-4 py-2">
      <h1 className="font-display text-[26px] text-ink">Run “{event.title}” again</h1>
      {!event.ownerId || errorCode === "owner" ? (
        <p className="text-[15px] text-ink-soft">
          Claim this event by signing in before you run it again.
        </p>
      ) : (
        <>
          <p className="text-[15px] text-ink-soft">
            The new draft keeps the brief, budget split, vendors and run sheet. Guests aren’t copied: invite them
            from your guest book.
          </p>
          <Card className="p-5">
            <form action={runAgainAction} className="space-y-4">
              <input type="hidden" name="eventId" value={event.id} />
              <Field
                label="New date and start time"
                error={errorCode === "date" ? "Pick a date and time." : undefined}
              >
                <Input type="datetime-local" name="date" required defaultValue={inputValue(suggested)} />
              </Field>
              <Button type="submit">Create the new draft</Button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
