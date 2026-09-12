"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createClubAction,
  updateClubAction,
  type ClubFormState,
} from "@/lib/actions/clubs";
import { Button, Field, FormError, Input, Textarea } from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Create or edit a club. Editing never touches the slug — it's in every link
 * to the club — so the form has no slug field, only a hidden one for routing.
 */
export function ClubForm({
  club,
}: {
  club?: { slug: string; name: string; city: string | null; description: string | null };
}) {
  const [state, formAction] = useActionState<ClubFormState, FormData>(
    club ? updateClubAction : createClubAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-5">
      {club ? <input type="hidden" name="slug" value={club.slug} /> : null}
      <FormError>{state?.error}</FormError>

      <Field label="Club name">
        <Input
          name="name"
          defaultValue={club?.name ?? ""}
          placeholder="Brooklyn Run Club"
          maxLength={60}
          required
          autoFocus={!club}
        />
      </Field>

      <Field label="City" hint="Where you mostly meet. Optional.">
        <Input name="city" defaultValue={club?.city ?? ""} placeholder="New York, NY" />
      </Field>

      <Field
        label="What it's about"
        hint="Shown on the club page. A sentence or two is plenty."
      >
        <Textarea
          name="description"
          rows={4}
          maxLength={500}
          defaultValue={club?.description ?? ""}
          placeholder="Easy 5k every Tuesday, then somewhere for a drink."
        />
      </Field>

      <Submit label={club ? "Save changes" : "Start the club"} />
    </form>
  );
}
