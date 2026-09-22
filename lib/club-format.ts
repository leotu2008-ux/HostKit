import { z } from "zod";

/**
 * Pure club helpers, safe to import from client components. The database
 * side (create, follow, members) lives in lib/clubs.ts.
 */

export const HANDLE_PATTERN = /^[a-z0-9-]{3,30}$/;
export const RESERVED_HANDLES = new Set(["new", "edit", "api", "c", "clubs", "admin", "hostkit", "hosty", "me"]);

/** What kind of club, for browsing. Stored as the key. */
export const CLUB_CATEGORIES = {
  social: "Social",
  professional: "Professional",
  sports: "Sports & fitness",
  arts: "Arts & music",
  cultural: "Cultural",
  service: "Service",
  academic: "Academic",
} as const;

export type ClubCategory = keyof typeof CLUB_CATEGORIES;

export const CLUB_CATEGORY_KEYS = Object.keys(CLUB_CATEGORIES) as ClubCategory[];

export function isClubCategory(value: unknown): value is ClubCategory {
  return typeof value === "string" && value in CLUB_CATEGORIES;
}

export function clubCategoryLabel(key: string | null | undefined): string | null {
  return isClubCategory(key) ? CLUB_CATEGORIES[key] : null;
}

export const clubSchema = z.object({
  name: z.string().trim().min(2, "Give the club a name.").max(60),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HANDLE_PATTERN, "Handles are 3–30 letters, numbers or dashes.")
    .refine((h) => !RESERVED_HANDLES.has(h), "That handle is reserved."),
  blurb: z.string().trim().max(280).optional(),
  city: z.string().trim().max(60).optional(),
  /** "" or absent = not set. */
  category: z
    .union([z.literal(""), z.enum(CLUB_CATEGORY_KEYS as [ClubCategory, ...ClubCategory[]])])
    .optional(),
});

export type ClubInput = z.infer<typeof clubSchema>;

/** An update to followers: a short note, one to a few lines. */
export const clubPostSchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(500, "Keep it under 500 characters."),
});

/** "Babson Entrepreneurship Club" → "babson-entrepreneurship-club". */
export function suggestHandle(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
  if (base.length >= 3 && !RESERVED_HANDLES.has(base)) return base;
  return (base + "-club").slice(0, 30);
}
