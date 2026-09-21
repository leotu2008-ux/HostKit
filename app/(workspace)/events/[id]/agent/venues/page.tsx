import { redirect } from "next/navigation";

// This route survives as a redirect rather than being deleted: it's the
// find_venues card's old href, kept working for any link, bookmark or
// digest email minted before the Venue tab existed at /events/[id]/venue.
export default async function AgentVenuesPage({ params }: PageProps<"/events/[id]/agent/venues">) {
  const { id } = await params;
  redirect(`/events/${id}/venue`);
}
