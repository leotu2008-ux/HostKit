"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { currentProfile, getCurrentUser, requireUser } from "@/lib/session";
import {
  ClubError,
  addMember,
  canManageClub,
  clubByHandle,
  clubSchema,
  createClub,
  follow,
  removeMember,
  unfollow,
} from "@/lib/clubs";
import { deleteImage, storeImage, validateImage } from "@/lib/images";

export type ClubFormState = { error?: string; saved?: boolean } | undefined;

export async function createClubAction(_prev: ClubFormState, formData: FormData): Promise<ClubFormState> {
  const user = await currentProfile();
  if (!user) redirect("/signin?next=%2Fclubs%2Fnew");
  const parsed = clubSchema.safeParse({
    name: formData.get("name"),
    handle: formData.get("handle"),
    blurb: formData.get("blurb") ?? "",
    city: formData.get("city") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  let handle: string;
  try {
    handle = (await createClub({ id: user.id, schoolDomain: user.schoolDomain }, parsed.data)).handle;
  } catch (error) {
    if (error instanceof ClubError) return { error: error.message };
    throw error;
  }
  redirect(`/c/${handle}`);
}

async function managedClub(handle: string) {
  const user = await requireUser(`/c/${handle}/edit`);
  const club = await clubByHandle(handle);
  if (!club || !(await canManageClub(user.id, club.id))) redirect(`/c/${handle}`);
  return { user, club };
}

export async function updateClubAction(_prev: ClubFormState, formData: FormData): Promise<ClubFormState> {
  const handle = String(formData.get("handle") ?? "");
  const { club } = await managedClub(handle);
  const parsed = clubSchema.omit({ handle: true }).safeParse({
    name: formData.get("name"),
    blurb: formData.get("blurb") ?? "",
    city: formData.get("city") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  await db.club.update({
    where: { id: club.id },
    data: { name: parsed.data.name, blurb: parsed.data.blurb || null, city: parsed.data.city || null },
  });
  refresh();
  return { saved: true };
}

export async function followClubAction(formData: FormData) {
  const handle = String(formData.get("handle") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/c/${handle}`)}`);
  const club = await clubByHandle(handle);
  if (!club) return;
  if (String(formData.get("intent") ?? "follow") === "unfollow") await unfollow(user.id, club.id);
  else await follow(user.id, club.id);
  refresh();
}

export async function addAdminAction(_prev: ClubFormState, formData: FormData): Promise<ClubFormState> {
  const { club } = await managedClub(String(formData.get("handle") ?? ""));
  try {
    await addMember(club.id, String(formData.get("email") ?? ""));
  } catch (error) {
    if (error instanceof ClubError) return { error: error.message };
    throw error;
  }
  refresh();
  return { saved: true };
}

export async function removeAdminAction(formData: FormData) {
  const { club } = await managedClub(String(formData.get("handle") ?? ""));
  try {
    await removeMember(club.id, String(formData.get("userId") ?? ""));
  } catch (error) {
    if (!(error instanceof ClubError)) throw error;
  }
  refresh();
}

type PhotoState = { error?: string } | undefined;

async function readFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an image first." } as const;
  const problem = validateImage(file.type, file.size);
  if (problem) return { error: problem } as const;
  return { file, bytes: Buffer.from(await file.arrayBuffer()) } as const;
}

export async function setClubPhotoAction(formData: FormData): Promise<PhotoState> {
  const { club } = await managedClub(String(formData.get("handle") ?? ""));
  const field = String(formData.get("field") ?? "imageUrl") === "coverUrl" ? "coverUrl" : "imageUrl";
  const read = await readFile(formData);
  if ("error" in read) return { error: read.error };
  const url = await storeImage({ bytes: read.bytes, contentType: read.file.type, key: `clubs/${club.id}-${field}` });
  await db.club.update({ where: { id: club.id }, data: { [field]: url } });
  await deleteImage(club[field]);
  refresh();
  return undefined;
}

export async function removeClubPhotoAction(formData: FormData): Promise<PhotoState> {
  const { club } = await managedClub(String(formData.get("handle") ?? ""));
  const field = String(formData.get("field") ?? "imageUrl") === "coverUrl" ? "coverUrl" : "imageUrl";
  await db.club.update({ where: { id: club.id }, data: { [field]: null } });
  await deleteImage(club[field]);
  refresh();
  return undefined;
}
