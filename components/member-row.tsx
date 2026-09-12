"use client";

import { useActionState } from "react";
import type { ClubRole } from "@/generated/prisma/enums";
import {
  removeMemberAction,
  setMemberRoleAction,
  type ClubFormState,
} from "@/lib/actions/clubs";
import { canChangeRole, ROLE_LABEL, ROLES } from "@/lib/clubs";
import { Badge, FormError, Select } from "@/components/ui";

/**
 * One member on the manage page. The controls are computed from the same
 * pure rules the server enforces (`canChangeRole`), so an admin never sees a
 * "make owner" option the action would refuse — the guard on the server is
 * the real gate; this just keeps the UI honest.
 */
export function MemberRow({
  slug,
  member,
  actorRole,
  isSelf,
}: {
  slug: string;
  member: { userId: string; name: string; email: string; role: ClubRole };
  actorRole: ClubRole;
  isSelf: boolean;
}) {
  const [roleState, roleAction] = useActionState<ClubFormState, FormData>(
    setMemberRoleAction,
    undefined,
  );
  const [removeState, removeAction] = useActionState<ClubFormState, FormData>(
    removeMemberAction,
    undefined,
  );

  const settable = isSelf
    ? []
    : ROLES.filter((r) => r !== member.role && canChangeRole(actorRole, member.role, r));
  const removable = !isSelf && canChangeRole(actorRole, member.role, null);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">
            {member.name}
            {isSelf ? <span className="text-ink-mute"> · you</span> : null}
          </p>
          <p className="truncate text-sm text-ink-soft">{member.email}</p>
        </div>

        {settable.length === 0 ? (
          <Badge tone={member.role === "MEMBER" ? "neutral" : "clay"}>
            {ROLE_LABEL[member.role]}
          </Badge>
        ) : (
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="userId" value={member.userId} />
            <Select
              key={member.role}
              name="role"
              defaultValue={member.role}
              className="h-9 py-0 text-sm"
              aria-label={`Role for ${member.name}`}
            >
              <option value={member.role}>{ROLE_LABEL[member.role]}</option>
              {settable.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            <button type="submit" className="text-sm font-medium text-clay hover:underline">
              Save
            </button>
          </form>
        )}

        {removable ? (
          <form action={removeAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="userId" value={member.userId} />
            <button
              type="submit"
              aria-label={`Remove ${member.name}`}
              className="text-sm text-ink-mute hover:text-danger"
            >
              Remove
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-2 space-y-1">
        <FormError>{roleState?.error}</FormError>
        <FormError>{removeState?.error}</FormError>
      </div>
    </div>
  );
}
