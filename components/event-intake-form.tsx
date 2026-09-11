"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { EventType } from "@/generated/prisma/enums";
import { createEventAction } from "@/lib/actions/events";
import { ALL_EVENT_TYPES, CITIES, EVENT_TYPE_LABEL } from "@/lib/catalog";
import { EVENT_TEMPLATES } from "@/lib/templates";
import { CoverArt } from "@/components/cover-art";
import { LocationField } from "@/components/location-field";
import { Button, FormError, Input, cx } from "@/components/ui";

function Submit({ signedIn }: { signedIn: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Saving…" : signedIn ? "Save this night" : "Save draft"}
    </Button>
  );
}

/** A labelled row inside a grouped panel, label left and control right. */
function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
      <span>
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {hint ? <span className="block text-[13px] text-ink-mute">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const compact =
  "min-h-10 rounded-lg border border-line bg-sunk px-3 text-[15px] text-ink focus:border-clay focus:outline-none";

function Segmented<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <div className="flex rounded-lg bg-sunk p-1">
      <input type="hidden" name={name} value={value} />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            "min-h-9 rounded-md px-3 text-sm font-medium",
            value === option.value
              ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.08)]"
              : "text-ink-soft",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EventIntakeForm({ signedIn }: { signedIn: boolean }) {
  const [state, formAction] = useActionState(createEventAction, undefined);
  const [type, setType] = useState<EventType>("DINNER_PARTY");
  const [ticketType, setTicketType] = useState<"FREE" | "PAID">("FREE");
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">(
    "UNLISTED",
  );
  const [title, setTitle] = useState("");
  const template = EVENT_TEMPLATES[type];
  const coverSeed = title.replace(/[^a-zA-Z0-9_-]/g, "") || "new-night";

  return (
    <form
      action={formAction}
      className="grid gap-8 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-10"
    >
      <input type="hidden" name="type" value={type} />

      <aside className="space-y-4">
        <div className="aspect-square overflow-hidden rounded-2xl bg-sunk shadow-[0_24px_60px_-28px_rgb(0_0_0/0.45)]">
          <CoverArt id={coverSeed} title={title || "New event"} />
        </div>
        <p className="text-[13px] text-ink-mute">
          The cover is drawn from the name — every night gets its own.
        </p>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-soft">
            Kind of night
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {ALL_EVENT_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                aria-pressed={type === option}
                className={cx(
                  "min-h-9 rounded-full border px-3 text-[13px] font-medium",
                  type === option
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-surface text-ink-soft hover:border-line-strong",
                )}
              >
                {EVENT_TYPE_LABEL[option]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-ink-mute">{template.blurb}</p>
        </fieldset>
      </aside>

      <div className="min-w-0 space-y-5">
        <FormError>{state?.error}</FormError>

        <input
          name="title"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event name"
          aria-label="Event name"
          className="font-event w-full bg-transparent text-[34px] leading-tight text-ink placeholder:text-ink-mute/60 focus:outline-none md:text-[42px]"
        />

        <div className="divide-y divide-line rounded-card border border-line bg-surface">
          <Row label="Date">
            <input name="date" type="date" className={compact} />
          </Row>
          <Row label="Start">
            <input name="time" type="time" className={compact} />
          </Row>
          <Row label="Hours" hint="Used to price hourly venues.">
            <input
              key={`hours-${type}`}
              name="durationHours"
              type="number"
              min={1}
              max={24}
              defaultValue={template.defaultDurationHours}
              required
              className={cx(compact, "w-24")}
            />
          </Row>
        </div>

        <div className="space-y-4 rounded-card border border-line bg-surface p-4">
          <LocationField />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">City</span>
            <select name="city" defaultValue={CITIES[0]} className={cx(compact, "w-full")}>
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-sm text-ink-mute">
              Where HostKit scouts venues and vendors.
            </span>
          </label>
        </div>

        <textarea
          name="description"
          rows={4}
          aria-label="Description"
          placeholder="Add a description — what should guests expect?"
          className="w-full rounded-card border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-mute focus:border-clay focus:outline-none"
        />

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-soft">Event options</p>
          <div className="divide-y divide-line rounded-card border border-line bg-surface">
            <Row label="Tickets">
              <Segmented
                name="ticketType"
                value={ticketType}
                onChange={setTicketType}
                options={[
                  { value: "FREE", label: "Free" },
                  { value: "PAID", label: "Paid" },
                ]}
              />
            </Row>
            {ticketType === "PAID" ? (
              <Row label="Price" hint="HostKit shows it; you collect it.">
                <Input
                  name="ticketPrice"
                  inputMode="decimal"
                  placeholder="25"
                  required
                  className="min-h-10 w-28"
                />
              </Row>
            ) : (
              <input type="hidden" name="ticketPrice" value="" />
            )}
            <Row label="Capacity">
              <input
                key={`guests-${type}`}
                name="guestCount"
                type="number"
                min={1}
                max={100000}
                defaultValue={template.defaultGuestCount}
                required
                className={cx(compact, "w-28")}
              />
            </Row>
            <Row
              label="Visibility"
              hint={
                visibility === "PUBLIC"
                  ? "On Discover once you publish."
                  : visibility === "UNLISTED"
                    ? "Anyone with the link."
                    : "Only you, even after you publish."
              }
            >
              <Segmented
                name="visibility"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: "PUBLIC", label: "Public" },
                  { value: "UNLISTED", label: "Unlisted" },
                  { value: "PRIVATE", label: "Private" },
                ]}
              />
            </Row>
            <Row label="Planning budget" hint="Optional. Splits venue and vendor spend.">
              <Input
                name="budget"
                inputMode="decimal"
                placeholder="5,000"
                className="min-h-10 w-32"
              />
            </Row>
          </div>
        </div>

        <p className="text-[13px] text-ink-mute">
          {signedIn
            ? "This stays a draft until you publish it."
            : "You can build this night now. Publishing it needs an account."}
        </p>

        <Submit signedIn={signedIn} />
      </div>
    </form>
  );
}
