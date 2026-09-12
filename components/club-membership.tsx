"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ClubRole } from "@/generated/prisma/enums";
import {
  joinClubAction,
  leaveClubAction,
  type ClubFormState,
} from "@/lib/actions/clubs";
import { ROLE_LABEL } from "@/lib/clubs";
import { Badge, Button, ButtonLink, FormError } from "@/components/ui";

function Pending({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? busy : idle}</>;
}

/**
 * Join / Leave for the public club page. Joining is a plain action — it can't
 * meaningfully fail. Leaving can: the last owner is refused, and the reason
 * has to be shown, so that one carries form state.
 */
export function ClubMembership({
  slug,
  role,
  signedIn,
}: {
  slug: string;
  role: ClubRole | null;
  signedIn: boolean;
}) {
  const [leaveState, leaveAction] = useActionState<ClubFormState, FormData>(
    leaveClubAction,
    undefined,
  );

  if (!signedIn) {
    return (
      <ButtonLink href={`/signin?next=${encodeURIComponent(`/c/${slug}`)}`}>
        Sign in to join
      </ButtonLink>
    );
  }

  if (!role) {
    return (
      <form action={joinClubAction}>
        <input type="hidden" name="slug" value={slug} />
        <Button type="submit">
          <Pending idle="Join" busy="Joining…" />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Badge tone={role === "MEMBER" ? "neutral" : "clay"}>
          {ROLE_LABEL[role]}
        </Badge>
        <form action={leaveAction}>
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" variant="secondary" size="sm">
            <Pending idle="Leave" busy="Leaving…" />
          </Button>
        </form>
      </div>
      <FormError>{leaveState?.error}</FormError>
    </div>
  );
}
