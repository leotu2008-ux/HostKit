import { db } from "@/lib/db";

/**
 * Opening the inquiry for a listing: the write behind both the host's own
 * "inquire" button (lib/actions/inquiries.ts) and the agent's vendor step
 * (lib/agent/vendor-step.ts).
 *
 * Deliberately NOT in lib/actions/. Next publishes every export of a
 * `"use server"` module as a callable endpoint, and this one takes an event
 * id, a listing id and free text. Exported from there, anyone on the internet
 * could plant a DRAFT inquiry carrying their own words on any event — words a
 * host might later press send on to a real business. Here it is an ordinary
 * module: the authenticated action does the requireEvent and then calls this,
 * and nothing reaches it from outside the server.
 *
 * Idempotent per (event, listing): a second call reopens the same thread
 * rather than starting a second one, and `update: {}` means it never
 * overwrites a message the host has since edited. Status is DRAFT and stays
 * DRAFT — this writes a draft, it does not mail anybody.
 */
export async function draftInquiry(eventId: string, listingId: string, message: string) {
  await db.inquiry.upsert({
    where: { eventId_listingId: { eventId, listingId } },
    create: { eventId, listingId, message, status: "DRAFT" },
    update: {},
  });

  // Enquiring is a strong signal of intent, so shortlist it too.
  await db.savedListing.upsert({
    where: { eventId_listingId: { eventId, listingId } },
    create: { eventId, listingId },
    update: {},
  });
}
