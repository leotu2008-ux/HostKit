"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { EventType } from "@/generated/prisma/enums";
import { createEventAction } from "@/lib/actions/events";
import { ALL_EVENT_TYPES, CITIES, EVENT_TYPE_LABEL } from "@/lib/catalog";
import { EVENT_TEMPLATES } from "@/lib/templates";
import { LocationField } from "@/components/location-field";
import {
  Button,
  cx,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

function Submit({ signedIn }: { signedIn: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Saving…" : signedIn ? "Save this night" : "Save draft"}
    </Button>
  );
}

export function EventIntakeForm({
  signedIn,
  clubs = [],
  defaultClubId,
}: {
  signedIn: boolean;
  /** Clubs the signed-in user can post as. Empty for everyone else. */
  clubs?: Array<{ id: string; name: string }>;
  defaultClubId?: string;
}) {
  const [state, formAction] = useActionState(createEventAction, undefined);
  const [type, setType] = useState<EventType>("DINNER_PARTY");
  const [ticketType, setTicketType] = useState<"FREE" | "PAID">("FREE");
  const template = EVENT_TEMPLATES[type];

  return (
    <form action={formAction} className="space-y-8">
      <FormError>{state?.error}</FormError>
      <input type="hidden" name="type" value={type} />

      {signedIn && clubs.length > 0 ? (
        <Field
          label="Post as"
          hint="A night posted as a club shows the club as its host, and the club's admins can run it too."
        >
          <Select name="clubId" defaultValue={defaultClubId ?? ""}>
            <option value="">Just me</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Name" hint="What guests will see.">
        <Input name="title" required maxLength={120} placeholder="Rooftop Jazz Night" />
      </Field>

      <fieldset className="grid gap-5">
        <legend className="mb-1 text-sm font-medium text-ink">Time</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input name="date" type="date" />
          </Field>
          <Field label="Start">
            <Input name="time" type="time" />
          </Field>
        </div>
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
      </fieldset>

      <LocationField />

      <Field label="City" hint="Where HostKit scouts venues and vendors.">
        <Select name="city" defaultValue={CITIES[0]}>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Description">
        <Textarea
          name="description"
          rows={4}
          placeholder="Warm lights, a quartet, and the city as the backdrop."
        />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Ticketing</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "FREE", label: "Free" },
              { value: "PAID", label: "Paid" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={ticketType === option.value}
              onClick={() => setTicketType(option.value)}
              className={cx(
                "min-h-12 rounded-lg border px-3 text-sm font-medium",
                ticketType === option.value
                  ? "border-clay bg-clay-wash text-clay-deep"
                  : "border-line bg-surface text-ink-soft",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="ticketType" value={ticketType} />
        {ticketType === "PAID" ? (
          <div className="mt-3">
            <Field label="Price" hint="HostKit tracks the price; you collect it yourself.">
              <Input name="ticketPrice" inputMode="decimal" placeholder="25" required />
            </Field>
          </div>
        ) : (
          <input type="hidden" name="ticketPrice" value="" />
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Visibility</legend>
        <div className="space-y-2">
          {(
            [
              {
                value: "PUBLIC",
                label: "Public",
                hint: "On Discover once you publish.",
              },
              {
                value: "UNLISTED",
                label: "Unlisted",
                hint: "Anyone with the link, not on Discover.",
              },
              {
                value: "PRIVATE",
                label: "Private",
                hint: "Only you, even after you publish.",
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className="flex min-h-12 items-start gap-3 rounded-card border border-line bg-surface px-4 py-3"
            >
              <input
                type="radio"
                name="visibility"
                value={option.value}
                defaultChecked={option.value === "UNLISTED"}
                className="mt-1 h-4 w-4 accent-clay"
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  {option.label}
                </span>
                <span className="text-sm text-ink-mute">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Capacity" hint="How many people this night can hold.">
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

      <fieldset>
        <legend className="font-display mb-2 text-lg text-ink">
          Kind of night
        </legend>
        <p className="mb-3 text-sm text-ink-soft">{template.blurb}</p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_EVENT_TYPES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              aria-pressed={type === option}
              className={cx(
                "min-h-12 rounded-lg border px-3 py-3 text-sm font-medium",
                type === option
                  ? "border-clay bg-clay-wash text-clay-deep"
                  : "border-line bg-surface text-ink-soft",
              )}
            >
              {EVENT_TYPE_LABEL[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="Planning budget"
        hint="Optional. Splits venue and vendor spend on the planner."
      >
        <Input name="budget" inputMode="decimal" placeholder="5,000" />
      </Field>

      <p className="rounded-card bg-sunk px-4 py-3 text-sm text-ink-soft">
        {signedIn
          ? "This stays a draft until you publish from the dashboard."
          : "You can build this night now. Publishing — putting it on Discover or sharing a live link — needs an account."}
      </p>

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <Submit signedIn={signedIn} />
      </div>
    </form>
  );
}
