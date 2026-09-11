"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { normalizeProfile, profileSchema } from "@/lib/profile";

export type ProfileFormState = { error?: string; saved?: boolean } | undefined;

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser("/profile");
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    classYear: formData.get("classYear") ?? "",
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  await db.user.update({ where: { id: user.id }, data: normalizeProfile(parsed.data) });
  refresh();
  return { saved: true };
}
