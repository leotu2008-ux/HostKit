import { SectionNav } from "@/components/section-nav";

/** The Guests tab's own sub-nav — Guests, Promote, Blasts, Door. Route group
 *  only; the URLs (/events/[id]/{guests,promote,blasts,check-in}) are
 *  unchanged. */
export default async function GuestsLayout({
  children,
  params,
}: LayoutProps<"/events/[id]">) {
  const { id } = await params;
  const base = `/events/${id}`;

  return (
    <div>
      <SectionNav
        label="Guests"
        items={[
          { href: `${base}/guests`, label: "Guests" },
          { href: `${base}/promote`, label: "Promote" },
          { href: `${base}/blasts`, label: "Blasts" },
          { href: `${base}/check-in`, label: "Door" },
        ]}
      />
      {children}
    </div>
  );
}
