"use server";

import { currentProfile } from "@/lib/session";
import { conflictCountFor, nightNote } from "@/lib/campus/conflicts";

/**
 * What else is on, for a date the host is still typing.
 *
 * The school comes from the session, never from the form: this is read-only
 * public campus data, but a client that can name any school is a client that
 * can probe any school, and there is no reason to allow it.
 *
 * Returns null when there is nothing to say — no school on the profile, an
 * unparseable date, or an evening that isn't busy.
 */
export async function checkNightAction(
  date: string,
): Promise<{ count: number; line: string } | null> {
  const profile = await currentProfile();
  if (!profile?.schoolDomain || !date) return null;

  // The date input gives a bare YYYY-MM-DD. Campus nights are evenings —
  // NIGHT_FROM_HOUR is 17 — so check the evening of the chosen day rather
  // than midnight, which would bucket into the night before.
  const evening = new Date(`${date}T20:00:00`);
  if (Number.isNaN(evening.getTime())) return null;

  const count = await conflictCountFor(profile.schoolDomain, evening);
  if (count === null) return null;

  const note = nightNote(count);
  return note ? { count, line: note.line } : null;
}
