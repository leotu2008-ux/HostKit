export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 pb-4 md:px-4 md:py-6">
      {children}
    </main>
  );
}
