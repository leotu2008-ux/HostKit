import { currentProfile } from "@/lib/session";
import { removeAvatarAction, setAvatarAction } from "@/lib/actions/photos";
import { Avatar } from "@/components/avatar";
import { ImageUpload } from "@/components/image-upload";
import { ProfileForm } from "@/components/profile-form";
import { VerifyEmailBanner } from "@/components/account-forms";
import { SocialLinks } from "@/components/social-links";
import { Badge, ButtonLink, Card } from "@/components/ui";

export const metadata = { title: "Profile" };

/** Mirrors the iOS app's Profile screen (behind the logo). */
export default async function ProfilePage() {
  const user = await currentProfile();

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <h1 className="font-display text-[30px] leading-tight text-ink md:text-[36px]">
        Profile
      </h1>

      {user ? (
        <>
          <Card className="mt-6 p-5">
            <div className="flex items-center gap-4">
              <Avatar name={user.name} imageUrl={user.imageUrl} size={56} />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-ink">{user.name}</p>
                <p className="truncate text-[15px] text-ink-soft">{user.email}</p>
                {user.school || user.company ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {user.school ? <Badge tone="clay">{user.school.name}</Badge> : null}
                    {user.school && user.classYear ? <Badge>Class of {user.classYear}</Badge> : null}
                    {user.company ? <Badge>{user.company}</Badge> : null}
                  </div>
                ) : null}
              </div>
            </div>
            {user.bio ? (
              <p className="mt-4 text-[15px] text-ink-soft">{user.bio}</p>
            ) : null}
            {!user.emailVerifiedAt ? <VerifyEmailBanner email={user.email} /> : null}
            <SocialLinks
              socials={{ x: user.xHandle, linkedin: user.linkedinHandle, instagram: user.instagramHandle }}
              className="mt-3"
            />
            <ImageUpload
              upload={setAvatarAction}
              remove={removeAvatarAction}
              hasImage={Boolean(user.imageUrl)}
              label="Change photo"
              className="mt-4"
            />
          </Card>

          <Card className="mt-4 p-5">
            <h2 className="mb-4 font-display text-lg text-ink">Edit profile</h2>
            <ProfileForm
              name={user.name}
              schoolDomain={user.schoolDomain}
              classYear={user.classYear}
              company={user.company}
              bio={user.bio}
              socials={{ x: user.xHandle, linkedin: user.linkedinHandle, instagram: user.instagramHandle }}
            />
            <p className="mt-3 text-[13px] text-ink-mute">
              {user.school
                ? `Your events are tagged ${user.school.short}.`
                : "Pick your school to tag your events."}
            </p>
          </Card>
        </>
      ) : (
        <Card className="mt-6 p-6 text-center">
          <p className="text-lg font-semibold text-ink">Host your own nights</p>
          <p className="mx-auto mt-1 max-w-sm text-[15px] text-ink-soft">
            Sign in to see the events you host, check guests in, and publish
            new ones — here or in the iOS app. Students: use your school .edu
            email to see what’s on at your campus first.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <ButtonLink href="/signin" size="lg">
              Sign in
            </ButtonLink>
            <ButtonLink href="/signup" variant="secondary" size="lg">
              Join the waitlist
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
