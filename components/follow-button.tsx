import { followClubAction } from "@/lib/actions/clubs";
import { Button } from "@/components/ui";

/** Follow / Following for a club page. Signed out, it sends you to sign in. */
export function FollowButton({ handle, following }: { handle: string; following: boolean }) {
  return (
    <form action={followClubAction}>
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="intent" value={following ? "unfollow" : "follow"} />
      <Button type="submit" variant={following ? "secondary" : "primary"} size="sm">
        {following ? "Following" : "Follow"}
      </Button>
    </form>
  );
}
