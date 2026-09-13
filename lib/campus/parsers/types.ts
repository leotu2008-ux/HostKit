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
  /** The feed's own id for that organisation, when it has one — lets the
   *  sync keep a Club for it (lib/campus/sync.ts). */
  hostId?: string | null;
  /** The feed's word for the organisation: "Student Organization", "Department"… */
  hostKind?: string | null;
};
