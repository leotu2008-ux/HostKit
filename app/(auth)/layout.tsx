import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <Link href="/" className="font-display text-2xl text-ink">
        Host<span className="text-clay">Kit</span>
      </Link>
      <div className="mt-8 w-full max-w-sm rounded-card border border-line bg-surface p-7">
        {children}
      </div>
    </main>
  );
}
