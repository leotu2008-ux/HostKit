"use client";

import { useEffect, useState } from "react";
import {
  paperFor,
  parsePreference,
  resolveTheme,
  THEME_COOKIE,
  type ThemePreference,
} from "@/lib/theme";
import { cx } from "@/components/ui";

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function readPreference(): ThemePreference {
  return parsePreference(document.documentElement.dataset.themePref);
}

export function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(
    preference,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePref = preference;
  root.style.colorScheme = resolved;
  try {
    localStorage.setItem(THEME_COOKIE, preference);
  } catch {
    /* private mode */
  }
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=31536000; SameSite=Lax`;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", paperFor(resolved));
  window.dispatchEvent(new Event("hostkit-theme"));
}

export function ThemeToggle({
  compact = false,
  initial = "system",
}: {
  compact?: boolean;
  initial?: ThemePreference;
}) {
  const [preference, setPreference] = useState<ThemePreference>(initial);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const syncPref = () => setPreference(readPreference());
    syncPref();
    window.addEventListener("hostkit-theme", syncPref);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => setSystemDark(mq.matches);
    const onSystemChange = () => {
      syncSystem();
      if (readPreference() === "system") applyTheme("system");
    };
    syncSystem();
    mq.addEventListener("change", onSystemChange);

    return () => {
      window.removeEventListener("hostkit-theme", syncPref);
      mq.removeEventListener("change", onSystemChange);
    };
  }, []);

  const resolved = resolveTheme(preference, systemDark);

  if (compact) {
    const next: ThemePreference = resolved === "dark" ? "light" : "dark";
    return (
      <button
        type="button"
        onClick={() => applyTheme(next)}
        aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-sunk hover:text-ink"
      >
        {resolved === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">Appearance</legend>
      <div className="grid grid-cols-3 gap-1 rounded-full bg-sunk p-1">
        {OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => applyTheme(option.value)}
              className={cx(
                "min-h-11 rounded-full text-sm font-medium",
                active ? "bg-surface text-ink" : "text-ink-soft",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] text-ink-mute">
        {preference === "system"
          ? `Following this device (${resolved}).`
          : `Saved as ${preference}.`}
      </p>
    </fieldset>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2M12 18.5v2M4.5 12h2M17.5 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16.5 13.5A7 7 0 1 1 10.5 5 5.5 5.5 0 0 0 16.5 13.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
