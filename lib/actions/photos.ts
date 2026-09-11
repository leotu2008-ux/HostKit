"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { deleteImage, storeImage, validateImage } from "@/lib/images";
import { requireEvent, requireUser } from "@/lib/session";

export type PhotoState = { error?: string } | undefined;

async function readFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an image first." } as const;
  const problem = validateImage(file.type, file.size);
  if (problem) return { error: problem } as const;
  return { file, bytes: Buffer.from(await file.arrayBuffer()) } as const;
}

export async function setAvatarAction(formData: FormData): Promise<PhotoState> {
  const user = await requireUser("/profile");
  const read = await readFile(formData);
  if ("error" in read) return { error: read.error };
  const url = await storeImage({ bytes: read.bytes, contentType: read.file.type, key: `avatars/${user.id}` });
  const previous = await db.user.findUnique({ where: { id: user.id }, select: { imageUrl: true } });
  await db.user.update({ where: { id: user.id }, data: { imageUrl: url } });
  await deleteImage(previous?.imageUrl);
  refresh();
  return undefined;
}

export async function removeAvatarAction(): Promise<PhotoState> {
  const user = await requireUser("/profile");
  const previous = await db.user.findUnique({ where: { id: user.id }, select: { imageUrl: true } });
  await db.user.update({ where: { id: user.id }, data: { imageUrl: null } });
  await deleteImage(previous?.imageUrl);
  refresh();
  return undefined;
}

export async function setCoverAction(formData: FormData): Promise<PhotoState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);
  const read = await readFile(formData);
  if ("error" in read) return { error: read.error };
  const url = await storeImage({ bytes: read.bytes, contentType: read.file.type, key: `covers/${event.id}` });
  await db.event.update({ where: { id: event.id }, data: { coverUrl: url } });
  await deleteImage(event.coverUrl);
  refresh();
  return undefined;
}

export async function removeCoverAction(formData: FormData): Promise<PhotoState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requireEvent(eventId);
  await db.event.update({ where: { id: event.id }, data: { coverUrl: null } });
  await deleteImage(event.coverUrl);
  refresh();
  return undefined;
}
