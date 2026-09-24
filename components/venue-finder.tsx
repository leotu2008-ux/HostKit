"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  attachVenueAction,
  findVenuesAction,
  type FindVenuesState,
} from "@/lib/actions/venues";
import { ContactLinks } from "@/components/contact-links";
import { Button, Card } from "@/components/ui";

/**
 * Maps candidates for this event, ranked by fit — and, when a model is
 * configured, by judgement on top of that.
 *
 * Behind an explicit press, not a render. Until Milestone 4 this searched
 * during the Venue tab's render, which was affordable while the whole thing
 * lived behind an agent card; as one of six primary tabs it meant a paid Maps
 * request and a model call on every visit, refresh and back-navigation, for
 * anyone holding a draft cookie. Nothing paid happens on a GET now: the tab
 * renders this button, and the search runs inside findVenuesAction with a
 * rate limit in front of it.
 *
 * The four ways there's nothing real to show — search unconfigured, a city
 * Hosty doesn't geocode, the provider erroring, the provider simply having
 * nothing — still all read as one quiet line rather than a 500 or a dead end.
 * The first two the page can tell before rendering anything (they're
 * server-rendered empty states); the last two only the action can.
 */

function SearchButton({ hasResults }: { hasResults: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Looking…" : hasResults ? "Search again" : "Find venues"}
    </Button>
  );
}

export function VenueFinder({
  eventId,
  summary,
}: {
  eventId: string;
  /** "Mixer for 40 in Boston." — the event line the results are ranked for,
   *  built on the server so this component needs no event row of its own. */
  summary: string;
}): React.JSX.Element {
  const [state, formAction] = useActionState(findVenuesAction, undefined as FindVenuesState);
  const results = state && "venues" in state ? state : null;

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="eventId" value={eventId} />
        <p className="text-[13px] text-ink-mute">{summary}</p>
        <SearchButton hasResults={results !== null} />
      </form>

      {state && "message" in state ? (
        <p className="text-[13px] text-ink-mute">{state.message}</p>
      ) : null}

      {results ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {results.venues.map((venue) => (
              <Card key={venue.id} className="p-4">
                <p className="font-medium text-ink">{venue.name}</p>
                {venue.address ? (
                  <p className="text-[13px] text-ink-soft">{venue.address}</p>
                ) : null}
                <p className="mt-1 text-[13px] text-ink-mute">{venue.reason}</p>
                <ContactLinks phone={venue.phone} website={venue.website} />
                <p className="mt-2 text-[13px] text-ink-mute italic">
                  Draft ready: &ldquo;{venue.subject}&rdquo;
                </p>
                <form action={attachVenueAction} className="mt-3">
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="name" value={venue.name} />
                  <input type="hidden" name="address" value={venue.address} />
                  <input type="hidden" name="phone" value={venue.phone ?? ""} />
                  <input type="hidden" name="website" value={venue.website ?? ""} />
                  <input type="hidden" name="externalId" value={venue.id} />
                  <input type="hidden" name="lat" value={venue.lat} />
                  <input type="hidden" name="lng" value={venue.lng} />
                  <Button type="submit" size="sm">
                    Add and draft a message
                  </Button>
                </form>
              </Card>
            ))}
          </div>

          <p className="text-[13px] text-ink-mute">
            {results.source === "fallback" ? "Ranked by what fits." : "Ranked for this event."}
          </p>
        </>
      ) : null}
    </div>
  );
}
