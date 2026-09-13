import { EventCard, toCampusCard, toEventCard, type EventCardEvent } from "@/components/event-card";
import type { CampusEventRow } from "@/lib/campus/feed";
import { sourceByKey } from "@/lib/campus/sources";
import { groupByDay } from "@/lib/day-groups";

type HostedRow = Parameters<typeof toEventCard>[0];

type Mixed = { key: string; date: Date | null; href: string; card: EventCardEvent };

/**
 * One list for "At [School]": nights students host there and the school's
 * official calendar, soonest first. Official rows open the school's page.
 */
export function mixCampus(hosted: HostedRow[], official: CampusEventRow[], take: number): Mixed[] {
  const rows: Mixed[] = [
    ...hosted.map((e) => ({ key: e.id, date: e.date, href: `/e/${e.id}`, card: toEventCard(e) })),
    ...official.map((row) => {
      const { href, ...card } = toCampusCard({ ...row, sourceName: sourceByKey(row.sourceKey)?.name });
      return { key: card.id, date: row.startsAt, href, card };
    }),
  ];
  rows.sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
  return rows.slice(0, take);
}

export function CampusMixList({ rows }: { rows: Mixed[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map((row) => (
        <li key={row.key}>
          <EventCard href={row.href} event={row.card} />
        </li>
      ))}
    </ul>
  );
}

/** The same list split by calendar day, so a week reads as a week. */
export function CampusMixByDay({ rows }: { rows: Mixed[] }) {
  return (
    <div className="space-y-6">
      {groupByDay(rows).map((day) => (
        <section key={day.key} aria-label={day.label}>
          <h3 className="mb-2 flex items-baseline gap-2 text-[15px] font-semibold text-ink">
            {day.label}
            {day.relative ? <span className="text-[13px] font-normal text-ink-mute">{day.relative}</span> : null}
          </h3>
          <CampusMixList rows={day.items} />
        </section>
      ))}
    </div>
  );
}
