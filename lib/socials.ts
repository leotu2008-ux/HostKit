/**
 * Social handles on a profile: X, LinkedIn, Instagram. People paste all
 * sorts — "@leo", "leo", "https://x.com/leo", "linkedin.com/in/leo/" — so
 * everything is boiled down to the handle and the link is rebuilt from it.
 * Pure; safe to import from client code.
 */

export type SocialKind = "x" | "linkedin" | "instagram";

export const SOCIAL_KINDS: SocialKind[] = ["x", "linkedin", "instagram"];

export const SOCIAL_LABEL: Record<SocialKind, string> = {
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
};

/** What a handle may look like once the URL and "@" are stripped. */
const PATTERN: Record<SocialKind, RegExp> = {
  x: /^[A-Za-z0-9_]{1,15}$/,
  linkedin: /^[A-Za-z0-9\-_%.]{3,100}$/,
  instagram: /^[A-Za-z0-9._]{1,30}$/,
};

const HOSTS: Record<SocialKind, RegExp> = {
  x: /^(?:www\.)?(?:x|twitter)\.com$/i,
  linkedin: /^(?:[a-z]{2,3}\.)?linkedin\.com$/i,
  instagram: /^(?:www\.)?instagram\.com$/i,
};

/**
 * The handle inside whatever was typed, or null when it's empty; throws
 * with a friendly message when it can't be one.
 */
export function normalizeHandle(kind: SocialKind, raw: string | null | undefined): string | null {
  let value = (raw ?? "").trim();
  if (!value) return null;
  if (/^(https?:\/\/|www\.|[a-z]{2,3}\.)?(x|twitter|linkedin|instagram)\.com/i.test(value) || value.includes("/")) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      throw new Error(`That ${SOCIAL_LABEL[kind]} link doesn't look right.`);
    }
    if (!HOSTS[kind].test(url.hostname)) {
      throw new Error(`That isn't a ${SOCIAL_LABEL[kind]} link.`);
    }
    const parts = url.pathname.split("/").filter(Boolean);
    // LinkedIn profiles live under /in/<handle>; the others are /<handle>.
    value = kind === "linkedin" && parts[0] === "in" ? (parts[1] ?? "") : (parts[0] ?? "");
  }
  value = value.replace(/^@/, "");
  if (!PATTERN[kind].test(value)) {
    throw new Error(`That ${SOCIAL_LABEL[kind]} handle doesn't look right.`);
  }
  return value;
}

export function socialUrl(kind: SocialKind, handle: string): string {
  switch (kind) {
    case "x":
      return `https://x.com/${handle}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${handle}`;
    case "instagram":
      return `https://www.instagram.com/${handle}`;
  }
}

/** "@leo" for X and Instagram; LinkedIn just shows the handle. */
export function socialDisplay(kind: SocialKind, handle: string): string {
  return kind === "linkedin" ? handle : `@${handle}`;
}
