"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { detectCity, isScoutedCity, suggestCities, type UsCity } from "@/lib/cities";
import { CITY_COOKIE } from "@/lib/city-cookie";
import { Badge, Input, cx } from "@/components/ui";

/**
 * Where the night is: type it, pick it, or let the browser say it.
 *
 * The four-item Select this replaces made Hosty look like it only worked in
 * four cities. It only *scouts* four (lib/catalog.ts) — so this takes any
 * city, marks the scouted ones, and says plainly what the others miss out on.
 *
 * The visible input is the form field, not a hidden mirror of one: free text
 * has to submit exactly as typed, since a host in a city nobody listed is the
 * case this whole change exists for.
 */

const DETECT_OPTIONS: PositionOptions = { timeout: 8_000, maximumAge: 600_000 };

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 14.5s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0c0 3.3 4.5 7.5 4.5 7.5Z" />
      <circle cx="8" cy="6.75" r="1.75" />
    </svg>
  );
}

/** Whether a previous prompt was already refused — the cookie
 *  components/city-detector.tsx writes when Discover's own ask is denied. */
function locationRefused(): boolean {
  return document.cookie.includes(`${CITY_COOKIE}=none`);
}

export function CityField({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [options, setOptions] = useState<UsCity[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // One detection per mount, whether it was the pin or the silent first-focus
  // attempt — a host who denied the prompt must not be asked again by tabbing
  // back through the form.
  const detected = useRef(false);
  /** Whether the silent first-focus attempt has had its one turn. */
  const autoTried = useRef(false);
  const listId = useId();

  const failed = () => setHint("Couldn't get your location — type the city instead");

  /**
   * Ask the browser where it is and fill the field in.
   *
   * `replace` is the whole difference between the two callers. Pressing the
   * pin is a host saying "put me where I am", so it overwrites whatever is
   * there — including the city saved with the event, which is the normal
   * state of this field and used to make the button a no-op that lied about
   * why. The silent first-focus attempt gets `replace: false` instead: it
   * never over-types a host who named somewhere themselves while the prompt
   * sat open, and it says nothing either way.
   */
  const detect = ({ replace }: { replace: boolean }) => {
    if (detected.current || !navigator.geolocation) {
      if (replace) failed();
      return;
    }
    detected.current = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const city = detectCity(position.coords.latitude, position.coords.longitude);
        if (!city) {
          // A real fix, but nowhere near anything listed — still a failure to
          // answer the question the host asked.
          if (replace) failed();
          return;
        }
        if (!replace && inputRef.current?.value) return;
        setValue(city);
        setOptions([]);
        setOpen(false);
        setHint("Set from your location");
      },
      () => {
        if (replace) failed();
      },
      DETECT_OPTIONS,
    );
  };

  // Auto-detect on the field's first focus, not on mount: a permission prompt
  // that appears before the host has touched anything reads as an ambush, and
  // one that follows a click on the city field reads as an answer. Read here
  // rather than in an effect so `document` is only touched in the browser.
  const onFocus = () => {
    if (autoTried.current) return;
    autoTried.current = true;
    if (inputRef.current?.value || locationRefused()) return;
    detect({ replace: false });
  };

  const change = (next: string) => {
    setValue(next);
    setHint(null);
    const found = suggestCities(next, 6);
    setOptions(found);
    setOpen(found.length > 0);
    setActive(-1);
  };

  const pick = (city: UsCity) => {
    setValue(city.name);
    setOptions([]);
    setOpen(false);
    setActive(-1);
    setHint(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!open || options.length === 0) {
      if (event.key === "ArrowDown" && options.length > 0) setOpen(true);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + options.length) % options.length);
      return;
    }
    if (event.key === "Enter" && active >= 0) {
      // Only when a suggestion is highlighted: Enter on plain typed text has
      // to stay the form's submit, which is how every other field behaves.
      event.preventDefault();
      pick(options[active]);
    }
  };

  const trimmed = value.trim();
  const unscouted = trimmed.length >= 2 && !isScoutedCity(trimmed);

  return (
    <div>
      <div className="relative">
        <Input
          ref={inputRef}
          name={name}
          value={value}
          onChange={(event) => change(event.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
          placeholder="Start typing a city"
          maxLength={80}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className="pr-11"
        />
        <button
          type="button"
          aria-label="Use my location"
          onClick={() => {
            // An explicit press always asks again, and always says what
            // happened — that's the difference from the silent attempt.
            autoTried.current = true;
            detected.current = false;
            detect({ replace: true });
          }}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-mute hover:bg-sunk hover:text-ink"
        >
          <PinIcon />
        </button>

        {open && options.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="City suggestions"
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_8px_24px_rgb(0_0_0/0.08)]"
          >
            {options.map((city, index) => (
              <li key={city.name}>
                <button
                  type="button"
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // The input keeps focus, so aria-activedescendant stays the
                  // only cursor and a click can't close the list before it
                  // lands.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(city)}
                  className={cx(
                    "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[15px] text-ink",
                    index === active ? "bg-sunk" : "hover:bg-sunk",
                  )}
                >
                  <span>{city.name}</span>
                  {isScoutedCity(city.name) ? <Badge tone="forest">Scouted</Badge> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {hint ? <span className="mt-1.5 block text-sm text-ink-mute">{hint}</span> : null}
      {unscouted ? (
        <span className="mt-1.5 block text-sm text-ink-mute">
          Hosty doesn&apos;t scout this city yet — the agent still drafts your plan.
        </span>
      ) : null}
    </div>
  );
}
