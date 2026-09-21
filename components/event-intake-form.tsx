"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createEventAction } from "@/lib/actions/events";
import { checkNightAction } from "@/lib/actions/night";
import { CITIES, EVENT_TYPE_OPTIONS } from "@/lib/catalog";
import { EVENT_TEMPLATES } from "@/lib/templates";
import type { EventType } from "@/generated/prisma/enums";

/** The night a host most often means when they open this form. The picker
 *  below can change it, and the plan, budget split and defaults all follow
 *  from whatever they choose. */
const DEFAULT_TYPE: EventType = "MIXER";

/** Capacity: type a number, or nudge it with − and +. Shared with the Brief
 *  tab (components/brief-form.tsx), which passes `min={0}` and
 *  `required={false}` — a blank event's guest count is genuinely unset, not
 *  "at least one person", so 0 renders as an empty field there. */
export function CapacityField({
  name,
  defaultValue,
  min = 1,
  required = true,
}: {
  name: string;
  defaultValue: number;
  min?: number;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const clamp = (n: number) => Math.min(100_000, Math.max(min, n));
  const bump = (delta: number) => setValue((v) => clamp((Number.isFinite(v) ? v : 0) + delta));
  const bumpClass =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-lg text-ink hover:border-line-strong disabled:opacity-40";

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => bump(-1)} aria-label="Fewer" className={bumpClass} disabled={value <= min}>
        −
      </button>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={100000}
        required={required}
        value={Number.isFinite(value) && value !== 0 ? value : ""}
        onChange={(e) => setValue(e.target.value === "" ? NaN : Number(e.target.value))}
        onBlur={() => setValue((v) => clamp(Number.isFinite(v) ? v : defaultValue))}
        aria-label="Capacity"
        className={cx(compact, "w-24 text-center")}
      />
      <button type="button" onClick={() => bump(1)} aria-label="More" className={bumpClass}>
        +
      </button>
    </div>
  );
}
import { CoverArt } from "@/components/cover-art";
import { VenueField } from "@/components/venue-field";
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

export function EventIntakeForm({
  signedIn,
  clubs = [],
  hasSchool = false,
}: {
  signedIn: boolean;
  /** Clubs the host manages — "Post as". */
  clubs?: Array<{ id: string; name: string }>;
  /** Whether the host's profile names a school, so there is a campus to check. */
  hasSchool?: boolean;
}) {
  const [state, formAction] = useActionState(createEventAction, undefined);
  const [type, setType] = useState<EventType>(DEFAULT_TYPE);
  const [nightLine, setNightLine] = useState<string | null>(null);
  // Duration and capacity defaults belong to the chosen night, not to a
  // hardcoded one — a study break is not a formal.
  const template = EVENT_TEMPLATES[type];
  const [city, setCity] = useState<string>(CITIES[0]);
  const [ticketType, setTicketType] = useState<"FREE" | "PAID">("FREE");
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">(
    "UNLISTED",
  );
  const [title, setTitle] = useState("");
  const coverSeed = title.replace(/[^a-zA-Z0-9_-]/g, "") || "new-night";

  return (
    <form
      action={formAction}
      className="grid gap-8 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-10"
    >
      <aside className="space-y-4">
        <div className="aspect-square overflow-hidden rounded-2xl bg-sunk shadow-[0_24px_60px_-28px_rgb(0_0_0/0.45)]">
          <CoverArt id={coverSeed} title={title || "New event"} />
        </div>
        <p className="text-[13px] text-ink-mute">
          The cover is drawn from the name — every night gets its own.
        </p>
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

        {clubs.length > 0 ? (
          <div className="divide-y divide-line rounded-card border border-line bg-surface">
            <Row label="Post as" hint="Followers of the club hear about it.">
              <select name="clubId" defaultValue="" className={compact}>
                <option value="">Yourself</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </Row>
          </div>
        ) : null}

        <div className="divide-y divide-line rounded-card border border-line bg-surface">
          <Row label="Kind">
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className={compact}
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Date">
            <input
              name="date"
              type="date"
              className={compact}
              aria-describedby="night-note"
              onChange={(e) => {
                const value = e.target.value;
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
          </Row>
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
          <Row label="Start">
            <input name="time" type="time" className={compact} />
          </Row>
          <Row label="Hours" hint="Used to price hourly venues.">
            <input
              key={type}
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

        <div className="space-y-5 rounded-card border border-line bg-surface p-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">City</span>
            <select
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={cx(compact, "w-full")}
            >
              {CITIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-sm text-ink-mute">
              Where the night is, and where HostKit looks for venues.
            </span>
          </label>
          <VenueField city={city} />
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
              <CapacityField key={type} name="guestCount" defaultValue={template.defaultGuestCount} />
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
