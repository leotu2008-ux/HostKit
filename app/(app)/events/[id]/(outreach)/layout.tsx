import { SectionNav } from "@/components/section-nav";

/** The Outreach tab's own sub-nav — Threads, Vendors, Shortlist. Route group
 *  only; the URLs (/events/[id]/{outreach,discover,shortlist}) are unchanged. */
export default async function OutreachLayout({
  children,
  params,
}: LayoutProps<"/events/[id]">) {
  const { id } = await params;
  const base = `/events/${id}`;

  return (
    <div>
      <SectionNav
        label="Outreach"
        items={[
          { href: `${base}/outreach`, label: "Threads" },
          { href: `${base}/discover`, label: "Vendors" },
          { href: `${base}/shortlist`, label: "Shortlist" },
        ]}
      />
      {children}
    </div>
  );
}
