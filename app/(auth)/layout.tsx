import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col px-5 py-8">
      <div className="w-full rounded-card border border-line bg-surface p-6">
        {children}
      </div>
      <p className="mt-6 text-center text-sm text-ink-mute">
        <Link href="/" className="text-clay">
          Back to Discover
        </Link>
      </p>
    </main>
  );
}
