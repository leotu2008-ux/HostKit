import { ButtonLink } from "@/components/ui";

export type CalendarLinks = { ics: string; google: string };

/** Apple / Outlook take the .ics; Google takes a template link. */
export function AddToCalendar({ links }: { links: CalendarLinks }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink href={links.ics} variant="secondary" size="sm">
        Add to Apple / Outlook
      </ButtonLink>
      <ButtonLink href={links.google} variant="secondary" size="sm" target="_blank" rel="noreferrer">
        Add to Google Calendar
      </ButtonLink>
    </div>
  );
}
