"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { approveWaitlistEntryAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Sending invite…" : "Confirm & email invite"}
    </Button>
  );
}

/** Two steps, no browser dialog: approving emails the person, so it's armed first. */
export function AdminApproveButton({ entryId, name }: { entryId: string; name: string }) {
  const [armed, setArmed] = useState(false);
  const [state, action] = useActionState(approveWaitlistEntryAction, undefined);
  if (!armed) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setArmed(true)} aria-label={`Let ${name} in`}>
        Let in
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
      <ConfirmButton />
      {state?.error ? (
        <p role="alert" className="w-full text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
