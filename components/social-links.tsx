import { SOCIAL_KINDS, SOCIAL_LABEL, socialDisplay, socialUrl, type SocialKind } from "@/lib/socials";

export type Socials = Partial<Record<SocialKind, string | null>>;

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.4 8.5L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.9-9L1 2h7l4.8 6.3L18.9 2Zm-1.2 18.2h1.9L7.4 3.7H5.4l12.3 16.5Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.4 2H3.6A1.6 1.6 0 0 0 2 3.6v16.8A1.6 1.6 0 0 0 3.6 22h16.8a1.6 1.6 0 0 0 1.6-1.6V3.6A1.6 1.6 0 0 0 20.4 2ZM8 19H5V9h3v10ZM6.5 7.7a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4ZM19 19h-3v-4.9c0-1.2 0-2.7-1.6-2.7s-1.9 1.3-1.9 2.6V19h-3V9h2.9v1.4h.1c.4-.8 1.4-1.6 2.8-1.6 3 0 3.6 2 3.6 4.6V19Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const ICON: Record<SocialKind, () => React.JSX.Element> = { x: XIcon, linkedin: LinkedInIcon, instagram: InstagramIcon };

/** The profile's social links as small pills; renders nothing when none are set. */
export function SocialLinks({ socials, className }: { socials: Socials; className?: string }) {
  const set = SOCIAL_KINDS.filter((k) => socials[k]);
  if (set.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      {set.map((kind) => {
        const Icon = ICON[kind];
        const handle = socials[kind] as string;
        return (
          <li key={kind}>
            <a
              href={socialUrl(kind, handle)}
              target="_blank"
              rel="noreferrer"
              title={SOCIAL_LABEL[kind]}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:border-line-strong hover:text-ink"
            >
              <Icon />
              {socialDisplay(kind, handle)}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
