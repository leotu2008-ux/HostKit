import { z } from "zod";

/**
 * Pure club helpers, safe to import from client components. The database
 * side (create, follow, members) lives in lib/clubs.ts.
 */

export const HANDLE_PATTERN = /^[a-z0-9-]{3,30}$/;
export const RESERVED_HANDLES = new Set(["new", "edit", "api", "c", "clubs", "admin", "hostkit", "me"]);

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
});

export type ClubInput = z.infer<typeof clubSchema>;

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
