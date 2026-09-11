export default function AppLayout({ children }: LayoutProps<"/">) {
  return <main className="flex-1 pb-2">{children}</main>;
}
