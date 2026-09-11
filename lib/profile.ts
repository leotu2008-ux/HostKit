import { z } from "zod";

const thisYear = new Date().getFullYear();

/** What a host can change about themselves. School comes from the email
 *  and isn't editable. */
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(80),
  classYear: z
    .union([z.literal(""), z.coerce.number().int().min(thisYear - 8).max(thisYear + 8)])
    .optional(),
  bio: z.string().trim().max(200).optional(),
});

export type ProfileInput = {
  name: string;
  classYear: number | null;
  bio: string | null;
};

export function normalizeProfile(parsed: z.infer<typeof profileSchema>): ProfileInput {
  return {
    name: parsed.name,
    classYear: typeof parsed.classYear === "number" ? parsed.classYear : null,
    bio: parsed.bio || null,
  };
}
