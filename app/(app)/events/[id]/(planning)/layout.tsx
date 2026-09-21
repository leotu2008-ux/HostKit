import { SectionNav } from "@/components/section-nav";

/** The Planning tab's own sub-nav — Plan, Budget, Run sheet. Route group
 *  only; the URLs (/events/[id]/{plan,budget,runsheet}) are unchanged. */
export default async function PlanningLayout({
  children,
  params,
}: LayoutProps<"/events/[id]">) {
  const { id } = await params;
  const base = `/events/${id}`;

  return (
    <div>
      <SectionNav
        label="Planning"
        items={[
          { href: `${base}/plan`, label: "Plan" },
          { href: `${base}/budget`, label: "Budget" },
          { href: `${base}/runsheet`, label: "Run sheet" },
        ]}
      />
      {children}
    </div>
  );
}
