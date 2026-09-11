import { Avatar } from "@/components/avatar";
import { goingSentence, type Attendee } from "@/lib/attendees";

/** Stacked faces and "Ada, Grace and 12 others are going". */
export function GoingRow({ attendees, total }: { attendees: Attendee[]; total: number }) {
  return (
    <div className="flex items-center gap-3">
      {attendees.length > 0 ? (
        <div className="flex -space-x-2">
          {attendees.slice(0, 5).map((a) => (
            <Avatar
              key={a.id}
              name={a.firstName}
              imageUrl={a.imageUrl}
              size={28}
              className="ring-2 ring-surface"
            />
          ))}
        </div>
      ) : null}
      <p className="text-[14px] text-ink-soft">
        {goingSentence(attendees.map((a) => a.firstName), total)}
      </p>
    </div>
  );
}
