import { db } from "@/lib/db";
import { icsFor } from "@/lib/calendar";
import { isPublicPageVisible } from "@/lib/listing";
import { eventUrl } from "@/lib/promote";

/** The event as a calendar file — what "Add to Calendar" downloads on the web. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = new URL(request.url).origin;
  const event = await db.event.findUnique({ where: { id } });
  if (!event || !isPublicPageVisible(event) || !event.date) {
    return new Response("Not found", { status: 404 });
  }
  const body = icsFor(
    {
      id: event.id,
      title: event.title,
      date: event.date,
      durationHours: event.durationHours,
      city: event.city,
      address: event.address,
      description: event.description,
    },
    eventUrl(origin, event.id),
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="hostkit-${event.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
