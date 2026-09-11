import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center px-5 py-8 md:py-16">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-[0_12px_40px_rgb(0_0_0/0.06)] md:p-8">
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
