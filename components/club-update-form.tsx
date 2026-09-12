"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { postClubUpdateAction, type ClubFormState } from "@/lib/actions/clubs";
import { Button, FormError, Textarea } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Posting…" : "Post to followers"}
    </Button>
  );
}

/** The admins' composer on a club page: one short note, straight to every follower's Inbox. */
export function ClubUpdateForm({ handle, followers }: { handle: string; followers: number }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ClubFormState, FormData>(
    async (prev, data) => {
      const result = await postClubUpdateAction(prev, data);
      if (result?.saved) form.current?.reset();
      return result;
    },
    undefined,
  );
  return (
    <form ref={form} action={formAction} className="space-y-2">
      <input type="hidden" name="handle" value={handle} />
      <FormError>{state?.error}</FormError>
      <Textarea
        name="body"
        rows={2}
        maxLength={500}
        required
        placeholder="Doors at 7, bring a friend. Tryouts moved to Thursday. Anything your followers should know."
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-mute">
          Lands in the Inbox of {followers} {followers === 1 ? "follower" : "followers"}, and by email when it’s set up.
        </p>
        <Submit />
      </div>
    </form>
  );
}
