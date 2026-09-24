"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/** The door's "Add and check in" button. Disables itself while the add is in flight, so a second tap at a busy door can't add the same walk-up twice. */
export function WalkUpSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="min-h-12! px-5" disabled={pending}>
      {pending ? "Adding…" : "Add and check in"}
    </Button>
  );
}
