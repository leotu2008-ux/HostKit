import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canManageClub, clubByHandle } from "@/lib/clubs";
import { addAdminAction, removeAdminAction, removeClubPhotoAction, setClubPhotoAction } from "@/lib/actions/clubs";
import { Avatar } from "@/components/avatar";
import { AdminForm } from "@/components/club-admin-form";
import { ClubForm } from "@/components/club-form";
import { ImageUpload } from "@/components/image-upload";
import { ButtonLink, Card } from "@/components/ui";

export const metadata = { title: "Manage club" };

export default async function EditClubPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const user = await requireUser(`/c/${handle}/edit`);
  const club = await clubByHandle(handle);
  if (!club || !(await canManageClub(user.id, club.id))) redirect(`/c/${handle}`);
  const members = await db.clubMember.findMany({
    where: { clubId: club.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { role: true, user: { select: { id: true, name: true, email: true, imageUrl: true } } },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">{club.name}</h1>
        <ButtonLink href={`/c/${club.handle}`} variant="secondary" size="sm">
          View page ↗
        </ButtonLink>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-4 font-display text-lg text-ink">Photos</h2>
        <div className="flex items-center gap-4">
          <Avatar name={club.name} imageUrl={club.imageUrl} size={64} className="rounded-2xl" />
          <ImageUpload
            upload={setClubPhotoAction}
            remove={removeClubPhotoAction}
            hasImage={Boolean(club.imageUrl)}
            fields={{ handle: club.handle, field: "imageUrl" }}
            label="Change picture"
          />
        </div>
        <div className="mt-4">
          <ImageUpload
            upload={setClubPhotoAction}
            remove={removeClubPhotoAction}
            hasImage={Boolean(club.coverUrl)}
            fields={{ handle: club.handle, field: "coverUrl" }}
            label="Change cover"
          />
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="mb-4 font-display text-lg text-ink">Details</h2>
        <ClubForm club={{ handle: club.handle, name: club.name, blurb: club.blurb, city: club.city, category: club.category }} />
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg text-ink">Admins</h2>
        <p className="mt-1 mb-4 text-[13px] text-ink-mute">
          Admins can post events as the club and run them. The last owner can’t be removed.
        </p>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user.id} className="flex items-center gap-3 py-3">
              <Avatar name={m.user.name} imageUrl={m.user.imageUrl} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{m.user.name}</span>
                <span className="block truncate text-[12px] text-ink-mute">
                  {m.user.email} · {m.role === "OWNER" ? "Owner" : "Admin"}
                </span>
              </span>
              {m.user.id !== user.id ? (
                <form action={removeAdminAction}>
                  <input type="hidden" name="handle" value={club.handle} />
                  <input type="hidden" name="userId" value={m.user.id} />
                  <button type="submit" className="text-sm text-ink-mute hover:text-danger">
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <AdminForm handle={club.handle} action={addAdminAction} />
        </div>
      </Card>
    </div>
  );
}
