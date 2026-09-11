import { z } from "zod";

const thisYear = new Date().getFullYear();

/** What a host can change about themselves. School comes from the email
 *  and isn't editable. Every field is optional so a client can send only
 *  what changed. */
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(80).optional(),
  classYear: z
    .union([z.literal(""), z.null(), z.coerce.number().int().min(thisYear - 8).max(thisYear + 8)])
    .optional(),
  bio: z.string().trim().max(200).nullable().optional(),
  showOnGuestLists: z
    .union([z.boolean(), z.literal("on"), z.literal("off"), z.literal("")])
    .optional(),
});

export type ProfileInput = {
  name?: string;
  classYear?: number | null;
  bio?: string | null;
  showOnGuestLists?: boolean;
};

/** Only the keys that were sent, so an update never wipes what wasn't. */
export function normalizeProfile(parsed: z.infer<typeof profileSchema>): ProfileInput {
  const out: ProfileInput = {};
  if (parsed.name !== undefined) out.name = parsed.name;
  if (parsed.classYear !== undefined) {
    out.classYear = typeof parsed.classYear === "number" ? parsed.classYear : null;
  }
  if (parsed.bio !== undefined) out.bio = parsed.bio || null;
  if (parsed.showOnGuestLists !== undefined) {
    out.showOnGuestLists =
      parsed.showOnGuestLists === true || parsed.showOnGuestLists === "on";
  }
  return out;
}
