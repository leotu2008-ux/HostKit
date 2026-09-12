import { db } from "@/lib/db";
import { apiError, apiUser, json, readJson } from "@/lib/api/http";
import { clubViewer } from "@/lib/api/clubs";
import { eventInclude, serializeClub, serializeClubUpdate, serializeEvent } from "@/lib/api/serialize";
import { canManageClub, clubByHandle, clubPastEvents, clubSchema, clubSelect, clubUpdates, officialClubEvents } from "@/lib/clubs";
import { serializeCampusEvent } from "@/lib/campus/feed";
import { upcomingOnly } from "@/lib/upcoming";

/** A club page: the club, its upcoming and past events (from the school's
 *  calendar too, for a synced club), updates, and who runs it. */
export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await apiUser(request);
  const club = await clubByHandle(handle);
  if (!club) return apiError("Not found.", 404);
  const [rel, events, members, past, updates, official] = await Promise.all([
    clubViewer(viewer?.id ?? null),
    db.event.findMany({
      where: { clubId: club.id, published: true, visibility: { not: "PRIVATE" }, ...upcomingOnly() },
      orderBy: [{ date: "asc" }, { createdAt: "desc" }],
      take: 20,
      include: eventInclude,
    }),
    db.clubMember.findMany({
      where: { clubId: club.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { role: true, user: { select: { id: true, name: true, imageUrl: true } } },
    }),
    clubPastEvents(club.id, 6),
    clubUpdates(club.id, 10),
    officialClubEvents(club, 20),
  ]);
  const manages = rel.managed.has(club.id);
  const merged = [
    ...events.map((e) => serializeEvent(e, e._count.guests, manages)),
    ...official.map(serializeCampusEvent),
  ].sort((a, b) => (a.startsAt ?? "9").localeCompare(b.startsAt ?? "9"));
  return json({
    club: serializeClub(club, rel),
    events: merged,
    past: past.rows.map((e) => serializeEvent(e, e._count.guests, manages)),
    members: members.map((m) => ({ id: m.user.id, name: m.user.name, imageUrl: m.user.imageUrl, role: m.role })),
    updates: updates.map(serializeClubUpdate),
    stats: { eventsHosted: past.total, followers: club._count.followers },
  });
}

const patchSchema = clubSchema.omit({ handle: true }).partial();

export async function PATCH(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await apiUser(request);
  const club = await clubByHandle(handle);
  if (!club) return apiError("Not found.", 404);
  if (!(await canManageClub(viewer?.id ?? null, club.id))) return apiError("Not found.", 404);
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Check the details.", 400);
  const updated = await db.club.update({
    where: { id: club.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.blurb !== undefined ? { blurb: parsed.data.blurb || null } : {}),
      ...(parsed.data.city !== undefined ? { city: parsed.data.city || null } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category || null } : {}),
    },
    select: clubSelect,
  });
  return json({ club: serializeClub(updated, await clubViewer(viewer!.id)) });
}
