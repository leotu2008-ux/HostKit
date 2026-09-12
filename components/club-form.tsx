"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClubAction, updateClubAction, type ClubFormState } from "@/lib/actions/clubs";
import { CLUB_CATEGORIES, suggestHandle } from "@/lib/club-format";
import { CITIES } from "@/lib/catalog";
import { Button, Field, FormError, Input, Select, Textarea } from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Create a club, or edit one (the handle is fixed once chosen). */
export function ClubForm({
  club,
}: {
  club?: { handle: string; name: string; blurb: string | null; city: string | null; category?: string | null };
}) {
  const [state, formAction] = useActionState<ClubFormState, FormData>(
    club ? updateClubAction : createClubAction,
    undefined,
  );
  const [name, setName] = useState(club?.name ?? "");
  const [handle, setHandle] = useState(club?.handle ?? "");
  const [handleTouched, setHandleTouched] = useState(Boolean(club));

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state?.error}</FormError>
      {state?.saved ? (
        <p className="rounded-lg bg-forest-wash px-3 py-2 text-sm text-forest">Saved.</p>
      ) : null}
      {club ? <input type="hidden" name="handle" value={club.handle} /> : null}

      <Field label="Name">
        <Input
          name="name"
          required
          maxLength={60}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!handleTouched) setHandle(suggestHandle(e.target.value));
          }}
          placeholder="Chess Club"
        />
      </Field>

      {club ? (
        <p className="text-[13px] text-ink-mute">
          Page: <span className="font-mono text-ink">/c/{club.handle}</span> — handles can’t change.
        </p>
      ) : (
        <Field label="Handle" hint="Your page lives at /c/handle. Letters, numbers and dashes.">
          <div className="flex items-center gap-1">
            <span className="text-ink-mute">/c/</span>
            <Input
              name="handle"
              required
              pattern="[a-z0-9-]{3,30}"
              value={handle}
              onChange={(e) => {
                setHandleTouched(true);
                setHandle(e.target.value.toLowerCase());
              }}
              className="w-64"
            />
          </div>
        </Field>
      )}

      <Field label="What it's about" hint="One or two lines. Optional.">
        <Textarea name="blurb" rows={3} maxLength={280} defaultValue={club?.blurb ?? ""} />
      </Field>

      <Field label="Kind of club" hint="Helps people browse. Optional.">
        <Select name="category" defaultValue={club?.category ?? ""} className="w-64">
          <option value="">Not set</option>
          {Object.entries(CLUB_CATEGORIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="City" hint="Where you mostly host.">
        <Select name="city" defaultValue={club?.city ?? ""} className="w-64">
          <option value="">Not set</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </Select>
      </Field>

      <Submit label={club ? "Save club" : "Create club"} />
    </form>
  );
}
