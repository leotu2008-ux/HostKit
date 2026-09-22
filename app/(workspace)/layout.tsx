import { requireMaya } from "@/lib/session";

/**
 * The workspace shell's outer wrapper.
 *
 * Every other page in the app renders inside `app/(app)/layout.tsx`, which
 * caps its content at max-w-5xl — the right width for a single-column page.
 * The event workspace is not a page: it is a sidebar, an app bar and a
 * content column that needs the whole window. Rather than widening the
 * shared shell (or breaking out of it with a negative margin, which is what
 * this layout used to do), the workspace gets its own route group with no
 * column of its own — `app/(workspace)/events/[id]/layout.tsx` owns the
 * frame. The URLs are untouched: `(workspace)` is a group, not a segment.
 */
export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  await requireMaya();
  return <div className="min-h-dvh">{children}</div>;
}
