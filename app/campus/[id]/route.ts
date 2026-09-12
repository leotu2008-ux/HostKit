import { NextResponse } from "next/server";
import { campusEventById } from "@/lib/campus/feed";

/** `/campus/:id` sends you to the event's page on the school's site. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await campusEventById(id);
  if (!event) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(event.url, 302);
}
