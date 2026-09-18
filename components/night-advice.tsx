import { Card } from "@/components/ui";
import type { NightAdvice } from "@/lib/campus/conflicts";

/**
 * What else is on that night, for the host who picked it.
 *
 * Says nothing at all when the night is fine. A panel that fires on every
 * event teaches people to ignore it, and the useful signal here is rare by
 * construction: most nights on a campus are ordinary.
 */

function dayLabel(night: Date): string {
  return night.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function timeLabel(at: Date): string {
  return at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export function NightAdvicePanel({
  advice,
  schoolShort,
}: {
  advice: NightAdvice;
  schoolShort: string;
}) {
  // Quiet and ordinary nights get no panel. Only speak up when it matters.
  if (advice.busyness !== "busy") return null;

  const { load, clashes, alternatives } = advice;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line bg-amber-wash px-5 py-3">
        <h2 className="font-display text-lg text-amber">
          {dayLabel(load.night)} is busy at {schoolShort}
        </h2>
        <p className="mt-0.5 text-[13px] text-amber">
          {load.count} other {load.count === 1 ? "thing" : "things"} on that evening.
        </p>
      </div>

      {clashes.length > 0 ? (
        <div className="px-5 py-4">
          <p className="text-[13px] font-medium text-ink-soft">Around your start time</p>
          <ul className="mt-2 space-y-1.5">
            {clashes.map((clash) => (
              <li key={clash.id} className="flex gap-3 text-[14px]">
                <span className="w-16 shrink-0 tabular-nums text-ink-mute">
                  {timeLabel(clash.startsAt)}
                </span>
                <a
                  href={clash.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 text-ink hover:underline"
                >
                  {clash.title}
                  {clash.host ? <span className="text-ink-mute"> · {clash.host}</span> : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {alternatives.length > 0 ? (
        <div className="border-t border-line px-5 py-4">
          <p className="text-[13px] font-medium text-ink-soft">Quieter nights in the next fortnight</p>
          <ul className="mt-2 space-y-1">
            {alternatives.map((alt) => (
              <li key={alt.night.toISOString()} className="text-[14px] text-ink">
                {dayLabel(alt.night)}
                <span className="text-ink-mute">
                  {" · "}
                  {alt.count === 0
                    ? "nothing else on"
                    : `${alt.count} other ${alt.count === 1 ? "thing" : "things"}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
