"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction, type ProfileFormState } from "@/lib/actions/profile";
import { SCHOOLS } from "@/lib/schools";
import { Button, Field, FormError, Input, Select, Textarea } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save profile"}
    </Button>
  );
}

/**
 * Name, school (or none), class year, company, bio. School drives the
 * campus feeds; company is for hosts who aren't students — or are, and
 * work too.
 */
export function ProfileForm({
  name,
  schoolDomain,
  classYear,
  company,
  bio,
  socials,
}: {
  name: string;
  schoolDomain: string | null;
  classYear: number | null;
  company: string | null;
  bio: string | null;
  socials: { x: string | null; linkedin: string | null; instagram: string | null };
}) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    undefined,
  );
  const [school, setSchool] = useState(schoolDomain ?? "");
  const knownSchool = SCHOOLS.some((s) => s.domain === school);

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state?.error}</FormError>
      {state?.saved ? (
        <p className="rounded-lg bg-forest-wash px-3 py-2 text-sm text-forest">Saved.</p>
      ) : null}
      <Field label="Name">
        <Input name="name" defaultValue={name} required maxLength={80} />
      </Field>
      <Field label="School" hint="Your campus feed follows this. Pick “Not a student” if that's you.">
        <Select name="schoolDomain" value={school} onChange={(e) => setSchool(e.target.value)} className="w-72">
          <option value="">Not a student</option>
          {SCHOOLS.map((s) => (
            <option key={s.domain} value={s.domain}>
              {s.name}
            </option>
          ))}
          {school && !knownSchool ? <option value={school}>{school}</option> : null}
        </Select>
      </Field>
      {school ? (
        <Field label="Class year" hint="Optional — shows on your events.">
          <Input
            name="classYear"
            type="number"
            inputMode="numeric"
            placeholder={String(new Date().getFullYear() + 2)}
            defaultValue={classYear ?? ""}
            className="w-32"
          />
        </Field>
      ) : null}
      <Field label="Company" hint="Where you work. Optional.">
        <Input name="company" defaultValue={company ?? ""} maxLength={80} placeholder="Acme Inc." />
      </Field>
      <Field label="About you" hint="One line. Optional.">
        <Textarea name="bio" rows={2} maxLength={200} defaultValue={bio ?? ""} />
      </Field>

      <fieldset className="space-y-3 rounded-xl border border-line p-4">
        <legend className="px-1 text-[13px] font-medium text-ink-soft">Connect</legend>
        <p className="text-[13px] text-ink-mute">
          Paste a handle or a profile link. They show on your profile as links.
        </p>
        <Field label="X">
          <Input name="x" defaultValue={socials.x ?? ""} placeholder="@handle or x.com/handle" maxLength={200} />
        </Field>
        <Field label="LinkedIn">
          <Input
            name="linkedin"
            defaultValue={socials.linkedin ?? ""}
            placeholder="linkedin.com/in/handle"
            maxLength={200}
          />
        </Field>
        <Field label="Instagram">
          <Input
            name="instagram"
            defaultValue={socials.instagram ?? ""}
            placeholder="@handle or instagram.com/handle"
            maxLength={200}
          />
        </Field>
      </fieldset>
      <Submit />
    </form>
  );
}
