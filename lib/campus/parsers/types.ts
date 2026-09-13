/** What every feed parser produces; lib/campus/sync.ts stores it. */
export type ParsedEvent = {
  externalId: string;
  title: string;
  description: string | null;
  /** Wall-clock start in the school's zone, encoded as UTC. */
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  location: string | null;
  url: string;
  imageUrl: string | null;
  /** Who's putting it on, when the feed says (a club, a department). */
  host?: string | null;
  /** Listed for the school community only; the place needs a school sign-in. */
  restricted?: boolean;
};
