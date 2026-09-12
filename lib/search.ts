/** A Prisma filter for "events whose title, description or host mentions q". Empty q matches all. */
export function eventSearch(q: string | null | undefined) {
  const term = q?.trim() ?? "";
  if (!term) return {};
  const contains = { contains: term, mode: "insensitive" as const };
  return {
    OR: [
      { title: contains },
      { description: contains },
      { address: contains },
      { owner: { name: contains } },
      { club: { name: contains } },
    ],
  };
}

/** The one search term from a page's query string, trimmed and capped. */
export function searchTerm(raw: string | string[] | undefined | null): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, 80);
}
