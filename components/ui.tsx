import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Joins class names, dropping falsy entries. */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand";

// Soft and tactile: pills that lift a pixel on hover and press in on click,
// primaries with a gentle gradient and a glow in their own colour. Nothing
// moves when a button is disabled or the reader asks for reduced motion, and
// every button shows a focus ring for the keyboard.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-150 ease-out active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0 disabled:scale-100 disabled:shadow-none motion-reduce:transform-none motion-reduce:transition-none";

const BUTTON_VARIANT: Record<Variant, string> = {
  primary: cx(
    // Written out in full: Tailwind only generates classes it can read in source.
    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-clay)_82%,white),var(--color-clay))]",
    "text-on-clay hover:-translate-y-px",
    "shadow-[0_4px_12px_-2px_color-mix(in_srgb,var(--color-clay)_35%,transparent),inset_0_1px_0_rgb(255_255_255/0.25)]",
    "hover:shadow-[0_8px_18px_-4px_color-mix(in_srgb,var(--color-clay)_45%,transparent),inset_0_1px_0_rgb(255_255_255/0.25)]",
  ),
  secondary: cx(
    "bg-surface text-ink hover:-translate-y-px",
    "shadow-[0_1px_2px_rgb(15_23_42/0.08),0_0_0_1px_rgb(15_23_42/0.08)]",
    "hover:shadow-[0_4px_10px_-2px_rgb(15_23_42/0.12),0_0_0_1px_rgb(15_23_42/0.1)]",
  ),
  ghost: "text-ink-soft hover:bg-sunk hover:text-ink hover:translate-y-0",
  danger:
    "bg-danger-wash text-danger hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--color-danger)_16%,white)]",
  // The landing's call to action: the brand blue, with a bigger glow.
  brand: cx(
    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-brand)_82%,white),var(--color-brand))]",
    "text-white hover:-translate-y-px",
    "shadow-[0_10px_24px_-8px_color-mix(in_srgb,var(--color-brand)_60%,transparent),inset_0_1px_0_rgb(255_255_255/0.3)]",
    "hover:shadow-[0_14px_28px_-8px_color-mix(in_srgb,var(--color-brand)_70%,transparent),inset_0_1px_0_rgb(255_255_255/0.3)]",
  ),
};

// Phones keep a 44px tap target at every size; on wider screens "small" is
// really small, so a row's button doesn't crowd the row.
const BUTTON_SIZE = {
  sm: "min-h-11 px-3.5 text-[13px] md:min-h-[34px]",
  md: "min-h-11 px-[18px] text-sm md:min-h-[42px]",
  lg: "min-h-12 px-[26px] text-base md:min-h-[50px]",
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
        "rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        className,
      )}
      {...props}
    />
  );
}

/** A section's label inside a workspace page: quiet, 15px, with the hint
 *  under it and whatever acts on the section aligned to its top-right. */
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
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {hint ? <p className="mt-1 text-[13px] text-ink-mute">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
    <div className="rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
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

/**
 * One labelled row of a form.
 *
 * `<label>` is right for a single input and wrong for a composite control: a
 * label with no `for` targets its first labelable descendant and runs its
 * activation behaviour, so clicking the word "Date" pressed the calendar's own
 * "Previous month" — and, once a date was set, its "Clear". Pass `composite`
 * for a control made of several buttons (components/calendar-picker.tsx,
 * components/time-wheel.tsx) and the row becomes a named group instead.
 */
export function Field({
  label,
  hint,
  error,
  children,
  composite = false,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  composite?: boolean;
}) {
  const body = (
    <>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-ink-mute">{hint}</span>
      ) : null}
    </>
  );
  return composite ? (
    <div role="group" aria-label={label} className="block">
      {body}
    </div>
  ) : (
    <label className="block">{body}</label>
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
