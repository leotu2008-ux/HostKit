import { z } from "zod";
import { SCHOOLS } from "@/lib/schools";
import { normalizeHandle, type SocialKind } from "@/lib/socials";

/** A social handle field: anything a person pastes, boiled down to the handle. */
function handleField(kind: SocialKind) {
  return z
    .string()
    .max(200)
    .nullable()
    .optional()
    .transform((raw, ctx) => {
      if (raw === undefined) return undefined;
      try {
        return normalizeHandle(kind, raw);
      } catch (error) {
        ctx.addIssue({ code: "custom", message: (error as Error).message });
        return z.NEVER;
      }
    });
}

const thisYear = new Date().getFullYear();

/**
 * What a host can change about themselves. Every field is optional so a
 * client can send only what changed. School starts from the sign-up email
 * and can be changed here — a known school's domain, or "" to be no
 * student at all — because official campus events follow it.
 */
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(80).optional(),
  classYear: z
    .union([z.literal(""), z.null(), z.coerce.number().int().min(thisYear - 8).max(thisYear + 8)])
    .optional(),
  bio: z.string().trim().max(200).nullable().optional(),
  /** Where they work; "" or null clears it. */
  company: z.string().trim().max(80).nullable().optional(),
  /** Handles or profile links; "" clears one. */
  x: handleField("x"),
  linkedin: handleField("linkedin"),
  instagram: handleField("instagram"),
  showOnGuestLists: z
    .union([z.boolean(), z.literal("on"), z.literal("off"), z.literal("")])
    .optional(),
  schoolDomain: z
    .union([
      z.literal(""),
      z.null(),
      z
        .string()
        .trim()
        .toLowerCase()
        .refine((d) => SCHOOLS.some((s) => s.domain === d), "Pick a school from the list."),
    ])
    .optional(),
});

export type ProfileInput = {
  name?: string;
  classYear?: number | null;
  bio?: string | null;
  company?: string | null;
  xHandle?: string | null;
  linkedinHandle?: string | null;
  instagramHandle?: string | null;
  showOnGuestLists?: boolean;
  schoolDomain?: string | null;
};

/** Only the keys that were sent, so an update never wipes what wasn't. */
export function normalizeProfile(parsed: z.infer<typeof profileSchema>): ProfileInput {
  const out: ProfileInput = {};
  if (parsed.name !== undefined) out.name = parsed.name;
  if (parsed.classYear !== undefined) {
    out.classYear = typeof parsed.classYear === "number" ? parsed.classYear : null;
  }
  if (parsed.bio !== undefined) out.bio = parsed.bio || null;
  if (parsed.company !== undefined) out.company = parsed.company || null;
  if (parsed.x !== undefined) out.xHandle = parsed.x;
  if (parsed.linkedin !== undefined) out.linkedinHandle = parsed.linkedin;
  if (parsed.instagram !== undefined) out.instagramHandle = parsed.instagram;
  if (parsed.showOnGuestLists !== undefined) {
    out.showOnGuestLists =
      parsed.showOnGuestLists === true || parsed.showOnGuestLists === "on";
  }
  if (parsed.schoolDomain !== undefined) out.schoolDomain = parsed.schoolDomain || null;
  return out;
}
