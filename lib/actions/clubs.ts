"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ClubRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requireClub, requireUser } from "@/lib/session";
import {
  canChangeRole,
  lastOwnerGuard,
  ROLES,
  slugify,
  uniqueSlug,
} from "@/lib/clubs";

export type ClubFormState = { error?: string } | undefined;

const clubSchema = z.object({
  name: z.string().trim().min(2, "Give the club a name.").max(60, "Keep the name under 60 characters."),
  city: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500, "Keep the description under 500 characters.").optional(),
});

/**
 * Starts a club. The creator becomes its OWNER in the same transaction, so
 * there is never a moment where a club exists with nobody able to run it.
 */
export async function createClubAction(
  _prev: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  const user = await requireUser("/clubs/new");

  const parsed = clubSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city") ?? undefined,
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // One query for every slug that could collide, then resolve in memory.
  const base = slugify(parsed.data.name);
  const existing = await db.club.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((c) => c.slug));
  const slug = uniqueSlug(base, (s) => taken.has(s));

  await db.$transaction(async (tx) => {
    const club = await tx.club.create({
      data: {
        slug,
        name: parsed.data.name,
        city: parsed.data.city || null,
        description: parsed.data.description || null,
      },
    });
    await tx.clubMember.create({
      data: { clubId: club.id, userId: user.id, role: "OWNER" },
    });
  });

  redirect(`/c/${slug}`);
}

export async function updateClubAction(
  _prev: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  const slug = String(formData.get("slug") ?? "");
  const { club } = await requireClub(slug, "ADMIN");

  const parsed = clubSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city") ?? undefined,
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // The slug is deliberately not editable: it's in every link to the club.
  await db.club.update({
    where: { id: club.id },
    data: {
      name: parsed.data.name,
      city: parsed.data.city || null,
      description: parsed.data.description || null,
    },
  });
  refresh();
  return undefined;
}

/** Self-serve: any signed-in user can join any club in v1. */
export async function joinClubAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const user = await requireUser(`/c/${slug}`);
  const club = await db.club.findUnique({ where: { slug }, select: { id: true } });
  if (!club) return;

  await db.clubMember.upsert({
    where: { clubId_userId: { clubId: club.id, userId: user.id } },
    create: { clubId: club.id, userId: user.id, role: "MEMBER" },
    update: {},
  });
  refresh();
}

export async function leaveClubAction(
  _prev: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  const slug = String(formData.get("slug") ?? "");
  const user = await requireUser(`/c/${slug}`);
  const club = await db.club.findUnique({
    where: { slug },
    include: { members: { select: { userId: true, role: true } } },
  });
  if (!club) return undefined;

  const guard = lastOwnerGuard(club.members, user.id, null);
  if (!guard.ok) return { error: guard.reason };

  await db.clubMember.deleteMany({ where: { clubId: club.id, userId: user.id } });
  refresh();
  return undefined;
}

const roleSchema = z.enum(ROLES as [ClubRole, ...ClubRole[]]);

export async function setMemberRoleAction(
  _prev: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  const slug = String(formData.get("slug") ?? "");
  const targetUserId = String(formData.get("userId") ?? "");
  const parsedRole = roleSchema.safeParse(formData.get("role"));
  if (!parsedRole.success) return { error: "That role isn't valid." };
  const next = parsedRole.data;

  const { user, club, role: actorRole } = await requireClub(slug, "ADMIN");
  if (targetUserId === user.id) {
    return { error: "You can't change your own role. Ask another owner." };
  }

  const members = await db.clubMember.findMany({
    where: { clubId: club.id },
    select: { userId: true, role: true },
  });
  const target = members.find((m) => m.userId === targetUserId);
  if (!target) return { error: "That person isn't a member." };

  if (!canChangeRole(actorRole, target.role, next)) {
    return { error: "Only an owner can change an owner's role or make one." };
  }
  const guard = lastOwnerGuard(members, targetUserId, next);
  if (!guard.ok) return { error: guard.reason };

  await db.clubMember.update({
    where: { clubId_userId: { clubId: club.id, userId: targetUserId } },
    data: { role: next },
  });
  refresh();
  return undefined;
}

export async function removeMemberAction(
  _prev: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  const slug = String(formData.get("slug") ?? "");
  const targetUserId = String(formData.get("userId") ?? "");
  const { user, club, role: actorRole } = await requireClub(slug, "ADMIN");
  if (targetUserId === user.id) {
    return { error: "Use “Leave club” to remove yourself." };
  }

  const members = await db.clubMember.findMany({
    where: { clubId: club.id },
    select: { userId: true, role: true },
  });
  const target = members.find((m) => m.userId === targetUserId);
  if (!target) return { error: "That person isn't a member." };

  if (!canChangeRole(actorRole, target.role, null)) {
    return { error: "Only an owner can remove another owner." };
  }
  const guard = lastOwnerGuard(members, targetUserId, null);
  if (!guard.ok) return { error: guard.reason };

  await db.clubMember.delete({
    where: { clubId_userId: { clubId: club.id, userId: targetUserId } },
  });
  refresh();
  return undefined;
}
