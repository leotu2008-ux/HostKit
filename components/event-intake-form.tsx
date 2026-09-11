"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { EventType } from "@/generated/prisma/enums";
import { createEventAction } from "@/lib/actions/events";
import { ALL_EVENT_TYPES, CITIES, EVENT_TYPE_LABEL } from "@/lib/catalog";
import { EVENT_TEMPLATES } from "@/lib/templates";
import {
  Button,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
  cx,
} from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Building your plan…" : "Build my plan"}
    </Button>
  );
}

export function EventIntakeForm() {
  const [state, formAction] = useActionState(createEventAction, undefined);
  const [type, setType] = useState<EventType>("WEDDING");

  // Picking a type re-suggests the headcount and duration typical for it.
  // Keyed inputs rather than controlled state: the host stays free to
  // overwrite the suggestion, but changing type gives them a fresh one.
  const template = EVENT_TEMPLATES[type];

  return (
    <form action={formAction} className="space-y-10">
      <FormError>{state?.error}</FormError>

      <fieldset>
        <legend className="font-display mb-1 text-lg text-ink">
          What are you hosting?
        </legend>
        <p className="mb-4 text-sm text-ink-soft">{template.blurb}</p>
        <input type="hidden" name="type" value={type} />
        <div className="grid grid-cols-2 gap-2">
          {ALL_EVENT_TYPES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              aria-pressed={type === option}
              className={cx(
                "min-h-12 rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                type === option
                  ? "border-clay bg-clay-wash text-clay-deep"
                  : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
              )}
            >
              {EVENT_TYPE_LABEL[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="font-display mb-4 text-lg text-ink">
          The basics
        </legend>

        <Field
          label="When is it?"
          hint="Leave blank if the date isn't settled — you can add it later."
        >
          <Input name="date" type="date" />
        </Field>

        <Field label="Where?">
          <Select name="city" defaultValue={CITIES[0]}>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="How many guests?">
          <Input
            key={`guests-${type}`}
            name="guestCount"
            type="number"
            min={1}
            max={100000}
            defaultValue={template.defaultGuestCount}
            required
          />
        </Field>

        <Field label="How many hours?" hint="Used to price hourly venues.">
          <Input
            key={`hours-${type}`}
            name="durationHours"
            type="number"
            min={1}
            max={24}
            defaultValue={template.defaultDurationHours}
            required
          />
        </Field>

        <Field
          label="Total budget"
          hint="A rough number is fine. Everything is split from this."
        >
          <Input
            name="budget"
            inputMode="decimal"
            placeholder="25,000"
            required
          />
        </Field>

        <Field label="Name it" hint="Optional — we'll name it for you.">
          <Input name="title" placeholder="Sam & Ali's wedding" />
        </Field>
      </fieldset>

      <fieldset>
        <legend className="font-display mb-4 text-lg text-ink">
          Anything else?
        </legend>
        <Field
          label="The vibe"
          hint="Optional. Helps you remember what you were going for."
        >
          <Textarea
            name="vibe"
            rows={3}
            placeholder="Relaxed, outdoors, long tables, good wine."
          />
        </Field>
      </fieldset>

      <label className="flex min-h-12 items-start gap-3 rounded-card border border-line bg-surface px-4 py-3">
        <input
          type="checkbox"
          name="published"
          defaultChecked
          className="mt-1 h-5 w-5 accent-clay"
        />
        <span>
          <span className="block text-sm font-medium text-ink">
            Publish to Discover
          </span>
          <span className="text-sm text-ink-mute">
            Guests can find this night and register. Uncheck to keep it unlisted.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <Submit />
        <p className="text-sm text-ink-mute">
          You can change any of this afterwards.
        </p>
      </div>
    </form>
  );
}
