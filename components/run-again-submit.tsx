"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/** The run-again form's submit button. Disables itself while the copy is being created, so a slow request (or an impatient second click) can't fire the action twice. */
export function RunAgainSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create the new draft"}
    </Button>
  );
}
