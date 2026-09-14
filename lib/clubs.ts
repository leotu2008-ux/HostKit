import { db } from "@/lib/db";
import { goingCount } from "@/lib/api/serialize";
import { pastOnly, upcomingOnly } from "@/lib/upcoming";
import { isClubCategory, type ClubInput } from "@/lib/club-format";
import { notify } from "@/lib/notify";

export {
  CLUB_CATEGORIES,
  CLUB_CATEGORY_KEYS,
  HANDLE_PATTERN,
  RESERVED_HANDLES,
  clubCategoryLabel,
  clubPostSchema,
  clubSchema,
  isClubCategory,
  suggestHandle,
} from "@/lib/club-format";
export type { ClubCategory, ClubInput } from "@/lib/club-format";

/**
 * Clubs: a page people follow, run by its admins, that events can be posted
 * as. The creator is the OWNER; owners and admins manage the club and every
 * event posted as it. Server-only (it opens the database); client code
 * wants lib/club-format.ts.
 */

export class ClubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const clubSelect = {
  id: true,
  handle: true,
  name: true,
  blurb: true,
  imageUrl: true,
  coverUrl: true,
  schoolDomain: true,
  city: true,
  category: true,
  sourceRef: true,
  isOfficial: true,
  _count: { select: { followers: true } },
} as const;

/** Where a synced club's events come from, for crediting it on the page. */
export function officialSourceKey(club: { sourceRef: string | null }): string | null {
  if (!club.sourceRef) return null;
  const i = club.sourceRef.lastIndexOf(":");
  return i > 0 ? club.sourceRef.slice(0, i) : null;
}

/** Upcoming official calendar events put on by a synced club. */
export async function officialClubEvents(club: { sourceRef: string | null }, take = 20) {
  if (!club.sourceRef) return [];
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return db.campusEvent.findMany({
    where: { hostRef: club.sourceRef, startsAt: { gte: today } },
    orderBy: [{ startsAt: "asc" }],
    take,
  });
}

/** Official calendar events from synced clubs the user follows. */
export async function followingOfficialEvents(userId: string, take = 12) {
  const refs = await db.follow.findMany({
    where: { userId, club: { sourceRef: { not: null } } },
    select: { club: { select: { sourceRef: true } } },
  });
  const hostRefs = refs.map((r) => r.club.sourceRef).filter((r): r is string => Boolean(r));
  if (hostRefs.length === 0) return [];
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return db.campusEvent.findMany({
    where: { hostRef: { in: hostRefs }, startsAt: { gte: today } },
    orderBy: [{ startsAt: "asc" }],
    take,
  });
}

export async function createClub(
  user: { id: string; schoolDomain: string | null },
  input: ClubInput,
) {
  const taken = await db.club.findUnique({ where: { handle: input.handle }, select: { id: true } });
  if (taken) throw new ClubError("That handle is taken.", 409);
  return db.club.create({
    data: {
      handle: input.handle,
      name: input.name,
      blurb: input.blurb || null,
      city: input.city || null,
      category: input.category || null,
      schoolDomain: user.schoolDomain,
      members: { create: { userId: user.id, role: "OWNER" } },
      // Founders follow their own club so it shows up on their Home.
      followers: { create: { userId: user.id } },
    },
    select: clubSelect,
  });
}

export async function canManageClub(userId: string | null, clubId: string): Promise<boolean> {
  if (!userId) return false;
  const row = await db.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId } },
    select: { role: true },
  });
  return row !== null;
}

/** Ids of every club this user manages. */
export async function managedClubIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const rows = await db.clubMember.findMany({ where: { userId }, select: { clubId: true } });
  return rows.map((r) => r.clubId);
}

export async function clubsFor(userId: string) {
  return db.club.findMany({
    where: { members: { some: { userId } } },
    orderBy: { name: "asc" },
    select: clubSelect,
  });
}

/** Clubs worth following: your school's first, then your city's. */
export async function suggestedClubs(
  viewer: { schoolDomain: string | null; city: string | null },
  take = 12,
) {
  const where = viewer.schoolDomain
    ? { schoolDomain: viewer.schoolDomain }
    : viewer.city
      ? { city: viewer.city }
      : {};
  return db.club.findMany({
    where,
    orderBy: [{ followers: { _count: "desc" } }, { createdAt: "asc" }],
    take,
    select: clubSelect,
  });
}

export async function followedClubIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await db.follow.findMany({ where: { userId }, select: { clubId: true } });
  return new Set(rows.map((r) => r.clubId));
}

export async function follow(userId: string, clubId: string) {
  await db.follow.upsert({
    where: { userId_clubId: { userId, clubId } },
    create: { userId, clubId },
    update: {},
  });
}

export async function unfollow(userId: string, clubId: string) {
  await db.follow.deleteMany({ where: { userId, clubId } });
}

/** Upcoming published events from clubs you follow. */
export async function followingEvents(userId: string, take = 12) {
  return db.event.findMany({
    where: {
      ...upcomingOnly(),
      published: true,
      visibility: { not: "PRIVATE" },
      club: { followers: { some: { userId } } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    take,
    include: {
      owner: { select: { name: true } },
      club: { select: { handle: true, name: true, imageUrl: true } },
      ...goingCount,
    },
  });
}

export async function clubByHandle(handle: string) {
  return db.club.findUnique({ where: { handle: handle.toLowerCase() }, select: clubSelect });
}

/** Add an admin by the email of an existing account. */
export async function addMember(clubId: string, email: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!user) throw new ClubError("No Student Events account with that email yet.", 404);
  await db.clubMember.upsert({
    where: { clubId_userId: { clubId, userId: user.id } },
    create: { clubId, userId: user.id, role: "ADMIN" },
    update: {},
  });
  return user.id;
}

/** Remove an admin; the last OWNER stays. */
export async function removeMember(clubId: string, userId: string) {
  const member = await db.clubMember.findUnique({ where: { clubId_userId: { clubId, userId } } });
  if (!member) return;
  if (member.role === "OWNER") {
    const owners = await db.clubMember.count({ where: { clubId, role: "OWNER" } });
    if (owners <= 1) throw new ClubError("A club keeps at least one owner.", 400);
  }
  await db.clubMember.delete({ where: { clubId_userId: { clubId, userId } } });
}

/**
 * Browse every club: a search term (name, blurb or handle) and/or a
 * category. The viewer's school's clubs come first, then by followers.
 */
export async function searchClubs(input: {
  q?: string | null;
  category?: string | null;
  schoolDomain?: string | null;
  take?: number;
}) {
  const q = input.q?.trim() ?? "";
  const category = isClubCategory(input.category) ? input.category : null;
  if (!q && !category) return [];
  const take = input.take ?? 40;
  const rows = await db.club.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { blurb: { contains: q, mode: "insensitive" as const } },
              { handle: { contains: q.toLowerCase().replace(/\s+/g, "-") } },
            ],
          }
        : {}),
    },
    orderBy: [{ followers: { _count: "desc" } }, { name: "asc" }],
    take: take * 2,
    select: clubSelect,
  });
  const mine = input.schoolDomain ?? null;
  return rows
    .sort((a, b) => Number(b.schoolDomain === mine) - Number(a.schoolDomain === mine))
    .slice(0, take);
}

/** Events the club already ran, newest first, and how many it has run in all. */
export async function clubPastEvents(clubId: string, take = 6) {
  const listed = { clubId, published: true as const, visibility: { not: "PRIVATE" as const } };
  const [rows, total] = await Promise.all([
    db.event.findMany({
      where: { ...listed, ...pastOnly() },
      orderBy: [{ date: "desc" }],
      take,
      include: {
        owner: { select: { name: true } },
        club: { select: { handle: true, name: true, imageUrl: true } },
        ...goingCount,
      },
    }),
    db.event.count({ where: listed }),
  ]);
  return { rows, total };
}

// ---------------------------------------------------------------------------
// Updates: a short note from the admins to everyone following.
// ---------------------------------------------------------------------------

export const clubPostSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, imageUrl: true } },
} as const;

export async function clubUpdates(clubId: string, take = 10) {
  return db.clubPost.findMany({ where: { clubId }, orderBy: { createdAt: "desc" }, take, select: clubPostSelect });
}

/** Posts an update and tells every follower (Inbox; email when configured). */
export async function postClubUpdate(club: { id: string; name: string }, authorId: string, body: string) {
  const post = await db.clubPost.create({ data: { clubId: club.id, authorId, body }, select: clubPostSelect });
  const followers = await db.follow.findMany({ where: { clubId: club.id }, select: { userId: true } });
  const short = body.length > 70 ? `${body.slice(0, 69).trimEnd()}…` : body;
  await notify(
    followers.map((f) => f.userId).filter((id) => id !== authorId),
    {
      kind: "club_update",
      title: `${club.name}: ${short}`,
      body: body.length > 70 ? body : "Open the club page for more.",
      clubId: club.id,
    },
  );
  return post;
}

export async function deleteClubUpdate(clubId: string, postId: string) {
  await db.clubPost.deleteMany({ where: { id: postId, clubId } });
}
