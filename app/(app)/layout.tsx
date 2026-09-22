import { requireMaya } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireMaya();
  return (
    <main className="theme-app mx-auto w-full max-w-5xl flex-1 pb-4 md:px-4 md:py-6">
      {children}
    </main>
  );
}
