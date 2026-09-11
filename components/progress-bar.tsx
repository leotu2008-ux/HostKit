import { cx } from "@/components/ui";

/** A budget bar. Caps the fill at 100% but keeps the over-budget color, so a
 *  wildly overspent category is obvious without the bar escaping its box. */
export function ProgressBar({
  percent,
  tone = "clay",
  className,
}: {
  percent: number;
  tone?: "clay" | "forest" | "amber" | "danger";
  className?: string;
}) {
  const fill: Record<string, string> = {
    clay: "bg-clay",
    forest: "bg-forest",
    amber: "bg-amber",
    danger: "bg-danger",
  };
  return (
    <div
      className={cx("h-2 w-full overflow-hidden rounded-full bg-sunk", className)}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx("h-full rounded-full transition-all", fill[tone])}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}
