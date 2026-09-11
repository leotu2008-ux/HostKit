import { db } from "@/lib/db";
import { goingCount } from "@/lib/api/serialize";
import { upcomingOnly } from "@/lib/upcoming";
import type { ClubInput } from "@/lib/club-format";

export { HANDLE_PATTERN, RESERVED_HANDLES, clubSchema, suggestHandle } from "@/lib/club-format";
export type { ClubInput } from "@/lib/club-format";

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
  _count: { select: { followers: true } },
} as const;

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
  if (!user) throw new ClubError("No HostKit account with that email yet.", 404);
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
