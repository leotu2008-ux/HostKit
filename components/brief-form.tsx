"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveBriefAction } from "@/lib/actions/brief";
import { checkNightAction } from "@/lib/actions/night";
import { EVENT_TYPE_LABEL, EVENT_TYPE_OPTIONS } from "@/lib/catalog";
import { eventTypeForKind, FALLBACK_TYPE } from "@/lib/brief";
import type { EventType } from "@/generated/prisma/enums";
import { CalendarPicker } from "@/components/calendar-picker";
import { CapacityField } from "@/components/capacity-field";
import { CityField } from "@/components/city-field";
import { DurationWheel } from "@/components/duration-wheel";
import { TimeWheel } from "@/components/time-wheel";
import { Button, Field, FormError, Input, Textarea } from "@/components/ui";

/** The pre-filled values the Brief tab shows back to the host — strings and
 *  numbers only, already unpacked server-side (app/(app)/events/[id]/brief/page.tsx)
 *  from the event row, so this component never has to know about Prisma or
 *  Date objects. */
export type BriefFormEvent = {
  id: string;
  title: string;
  kind: string;
  /** The saved planning type, which Jev may have chosen for words the
   *  keyword table doesn't know (lib/brief-classify.ts). */
  type?: EventType;
  date: string;
  time: string;
  durationHours: number;
  city: string;
  guestCount: number;
  budget: string;
  description: string;
  address: string;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save the brief"}
    </Button>
  );
}

/** The one form that fills in an event's brief — everything the agent needs
 *  to draft a plan, find a venue and write the first outreach message. Saved
 *  as a whole; a host can come back and resubmit it as many times as they like. */
export function BriefForm({ event, hasSchool }: { event: BriefFormEvent; hasSchool: boolean }) {
  const [state, formAction] = useActionState(saveBriefAction, undefined);
  const [kind, setKind] = useState(event.kind);
  const [nightLine, setNightLine] = useState<string | null>(null);

  // The keywords answer live as the host types; for the words already saved,
  // the saved type is the answer, whoever chose it.
  const kindType =
    eventTypeForKind(kind) ??
    (kind === event.kind && event.type && event.type !== FALLBACK_TYPE ? event.type : null);
  const kindHint = kindType
    ? `Planning this like a ${EVENT_TYPE_LABEL[kindType].toLowerCase()}`
    : kind.trim()
      ? "New to us — the agent will plan from your words"
      : undefined;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="eventId" value={event.id} />
      <FormError>{state?.error}</FormError>

      <Field label="Title">
        <Input
          name="title"
          defaultValue={event.title}
          maxLength={120}
          placeholder="Name this night"
          className="font-event text-[24px]"
        />
      </Field>

      <Field label="Kind" hint={kindHint}>
        <Input
          name="kind"
          list="kind-suggestions"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          placeholder="dinner party, mixer, pitch night…"
        />
        <datalist id="kind-suggestions">
          {EVENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.label} />
          ))}
        </datalist>
      </Field>

      {/* The calendar and the wheel each want their own ~320px column, so the
          pair only sits side by side once there's room for both. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Date" composite>
          <CalendarPicker
            name="date"
            defaultValue={event.date}
            describedBy={nightLine ? "night-note" : undefined}
            onChange={(value) => {
              if (!hasSchool || !value) {
                setNightLine(null);
                return;
              }
              // Advisory only: a failure here must never block the form, so
              // there is no error state — the note simply doesn't appear.
              void checkNightAction(value)
                .then((note) => setNightLine(note?.line ?? null))
                .catch(() => setNightLine(null));
            }}
          />
        </Field>
        <Field label="Start" composite>
          <TimeWheel name="time" defaultValue={event.time} />
        </Field>
      </div>
      {nightLine ? (
        <div
          id="night-note"
          role="status"
          aria-live="polite"
          className="bg-amber-wash px-4 py-3 text-[13px] text-amber"
        >
          {nightLine}
        </div>
      ) : null}

      <Field label="Duration" composite hint="Quarter-hour steps.">
        <DurationWheel name="durationHours" defaultValue={event.durationHours} />
      </Field>

      <Field label="City">
        <CityField name="city" defaultValue={event.city} />
      </Field>

      <Field label="Guests">
        <CapacityField name="guestCount" defaultValue={event.guestCount} min={0} required={false} />
      </Field>

      <Field label="Budget" hint="The agent splits this across venue and vendors.">
        <Input name="budget" inputMode="decimal" defaultValue={event.budget} placeholder="5,000" />
      </Field>

      <Field label="Vibe">
        <Textarea
          name="description"
          rows={4}
          defaultValue={event.description}
          placeholder="What should guests expect?"
        />
      </Field>

      <details className="rounded-xl border border-line bg-surface p-4" open={Boolean(event.address)}>
        <summary className="cursor-pointer text-[15px] font-medium text-ink">
          I already have a venue
        </summary>
        <div className="mt-3">
          <Input name="address" defaultValue={event.address} placeholder="Address" />
        </div>
      </details>

      <div className="flex items-center gap-3">
        <Submit />
        {state?.saved ? <p className="text-[13px] text-ink-mute">Saved.</p> : null}
      </div>
    </form>
  );
}
