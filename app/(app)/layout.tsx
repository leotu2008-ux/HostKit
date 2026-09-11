import { SiteHeader } from "@/components/site-header";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </>
  );
}
