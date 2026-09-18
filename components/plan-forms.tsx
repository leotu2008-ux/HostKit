"use client";

import { useFormStatus } from "react-dom";
import { regeneratePlanAction } from "@/lib/actions/plan";

/** Disabled while pending so a double-click can't fire two redrafts — the
 *  second would insert a duplicate generated task set. */
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-full px-4 text-sm font-medium text-ink-mute hover:text-ink disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? "Redrafting…" : "Redraft the plan"}
    </button>
  );
}

export function RedraftPlan({ eventId }: { eventId: string }) {
  return (
    <form action={regeneratePlanAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <Submit />
    </form>
  );
}
