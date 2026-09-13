import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Joins class names, dropping falsy entries. */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANT: Record<Variant, string> = {
  primary: "bg-clay text-on-clay hover:bg-clay-deep",
  secondary:
    "bg-surface text-ink border border-line-strong hover:border-ink-mute hover:bg-sunk",
  ghost: "text-ink-soft hover:bg-sunk hover:text-ink",
  danger: "bg-danger-wash text-danger hover:bg-danger hover:text-white",
};

const BUTTON_SIZE = {
  sm: "min-h-11 px-3.5 text-sm",
  md: "min-h-12 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
} as const;

type ButtonSize = keyof typeof BUTTON_SIZE;

export function buttonClass(
  variant: Variant = "primary",
  size: ButtonSize = "md",
  extra?: string,
) {
  return cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "rounded-card border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.03)]",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-ink-soft">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Shown wherever a list is legitimately empty, so a blank area always
 *  explains itself and offers the next step. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "clay" | "forest" | "amber" | "danger";

const TONE: Record<Tone, string> = {
  neutral: "bg-sunk text-ink-soft",
  clay: "bg-brand-wash text-brand",
  forest: "bg-forest-wash text-forest",
  amber: "bg-amber-wash text-amber",
  danger: "bg-danger-wash text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-ink-mute">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full min-h-12 rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-mute focus:border-clay focus:outline-none focus-visible:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "pr-8", className)} {...props} />;
}

/** Inline form-level error. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-danger-wash px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}
