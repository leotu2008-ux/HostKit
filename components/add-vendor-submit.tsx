"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/** The vendor book's "Add to this event" button. Disables itself while the add is in flight, so a double-click can't fire the action twice. */
export function AddVendorSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add to this event"}
    </Button>
  );
}
