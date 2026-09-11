import type { ReactNode } from "react";

/** A little calendar leaf: month on top, day below. */
export function DateTile({ date }: { date: Date | null }) {
  return (
    <div
      aria-hidden
      className="flex h-11 w-11 shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-surface text-center"
    >
      <span className="bg-sunk text-[9px] leading-4 font-semibold tracking-wide text-ink-mute uppercase">
        {date ? date.toLocaleDateString("en-US", { month: "short" }) : "TBA"}
      </span>
      <span className="flex flex-1 items-center justify-center text-[17px] leading-none font-semibold text-ink">
        {date ? date.getDate() : "–"}
      </span>
    </div>
  );
}

/** Same footprint as DateTile, for an icon (location, tickets…). */
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft"
    >
      {children}
    </div>
  );
}

export function InfoRow({
  tile,
  title,
  detail,
}: {
  tile: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5">
      {tile}
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{title}</p>
        {detail ? (
          <p className="truncate text-[14px] text-ink-soft">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

export function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 7v10" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2 2" />
    </svg>
  );
}
