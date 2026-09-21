import { createBlankEventAction } from "@/lib/actions/events";
import { Button } from "@/components/ui";

/**
 * Every "Create event" control in the app: a form, not a link, because
 * pressing it mints a row (lib/actions/events.ts createBlankEventAction) —
 * a GET to /events/new must never do that.
 *
 * This renders inside AppFrame, so it's on every page in the app including
 * auth screens. No explicit `type` on the button: a `<button>` inside a
 * `<form>` submits by default anyway, and leaving the attribute off keeps
 * this button from answering to `button[type="submit"]`, the selector every
 * other page's own form already uses for *its* submit button.
 */
export function CreateEventButton({
  label = "Create event",
  size = "md",
  variant = "primary",
  className,
}: {
  label?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "brand";
  className?: string;
}) {
  return (
    <form action={createBlankEventAction}>
      <Button size={size} variant={variant} className={className}>
        {label}
      </Button>
    </form>
  );
}
