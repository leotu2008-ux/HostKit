import { deleteClubUpdateAction } from "@/lib/actions/clubs";
import { Avatar } from "@/components/avatar";

export type ClubUpdateRow = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; imageUrl: string | null } | null;
};

function when(date: Date): string {
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The club's latest notes to followers; admins can take one down. */
export function ClubUpdates({
  handle,
  updates,
  canManage,
}: {
  handle: string;
  updates: ClubUpdateRow[];
  canManage: boolean;
}) {
  if (updates.length === 0) return null;
  return (
    <ol className="space-y-3">
      {updates.map((u) => (
        <li key={u.id} className="rounded-card border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-[12px] text-ink-mute">
            {u.author ? <Avatar name={u.author.name} imageUrl={u.author.imageUrl} size={20} /> : null}
            <span className="truncate">{u.author?.name ?? "The club"}</span>
            <span aria-hidden>·</span>
            <time dateTime={u.createdAt.toISOString()}>{when(u.createdAt)}</time>
            {canManage ? (
              <form action={deleteClubUpdateAction} className="ml-auto">
                <input type="hidden" name="handle" value={handle} />
                <input type="hidden" name="postId" value={u.id} />
                <button type="submit" className="text-[12px] text-ink-mute underline hover:text-ink">
                  Remove
                </button>
              </form>
            ) : null}
          </div>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink">{u.body}</p>
        </li>
      ))}
    </ol>
  );
}
