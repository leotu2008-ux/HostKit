import { headers } from "next/headers";
import { siteOrigin } from "@/lib/site";
import { requireEvent } from "@/lib/session";
import { VISIBILITY_LABEL } from "@/lib/listing";
import { schoolFor } from "@/lib/schools";
import { qrSvg } from "@/lib/qr";
import { eventUrl, promoBlurb } from "@/lib/promote";
import {
  publishEventAction,
  setApprovalAction,
  setVisibilityAction,
  unpublishEventAction,
} from "@/lib/actions/events";
import { CopyButton } from "@/components/copy-button";
import { Badge, Button, ButtonLink, Card, SectionHeading, cx } from "@/components/ui";

const VISIBILITIES = [
  { value: "PUBLIC", label: "Public", hint: "Listed on Discover." },
  { value: "UNLISTED", label: "Unlisted", hint: "Anyone with the link." },
  { value: "PRIVATE", label: "Private", hint: "Only you." },
] as const;

/** Get the word out: publish, share the link, a QR code, and paste-ready copy. */
export default async function PromotePage({ params }: PageProps<"/events/[id]/promote">) {
  const { id } = await params;
  const { event, user } = await requireEvent(id);
  const h = await headers();
  const origin = siteOrigin(h);
  const link = eventUrl(origin, event.id);
  const [qr, school] = [await qrSvg(link), schoolFor(event.schoolDomain)];
  const blurb = promoBlurb(
    {
      title: event.title,
      date: event.date,
      city: event.city,
      address: event.address,
      ticketType: event.ticketType,
      description: event.description,
    },
    link,
  );

  return (
    // The tab now shares a narrower workspace column with the sidebar and
    // agent rail (see app/(app)/events/[id]/layout.tsx), so this stacks
    // rather than claiming its own two-column page width — a fixed 340px
    // side track no longer fits next to it.
    <div className="space-y-8">
      <section>
        <SectionHeading
          title="Status"
          hint={
            event.published
              ? `Live. ${VISIBILITY_LABEL[event.visibility]}${school ? ` · shown first to ${school.short} students` : ""}.`
              : "A draft. Guests can't see it or register until you publish."
          }
        />
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={event.published ? "forest" : "amber"}>
              {event.published ? "Published" : "Draft"}
            </Badge>
            {event.published ? (
              <form action={unpublishEventAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Unpublish
                </Button>
              </form>
            ) : user ? (
              <form action={publishEventAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <Button type="submit" size="sm">
                  Publish
                </Button>
              </form>
            ) : (
              <ButtonLink
                href={`/signin?next=${encodeURIComponent(`/events/${event.id}/promote`)}&publish=1`}
                size="sm"
              >
                Sign in to publish
              </ButtonLink>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">Who can find it</p>
            <div className="flex flex-wrap gap-1.5">
              {VISIBILITIES.map((option) => (
                <form key={option.value} action={setVisibilityAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="visibility" value={option.value} />
                  <button
                    type="submit"
                    aria-pressed={event.visibility === option.value}
                    title={option.hint}
                    className={cx(
                      "rounded-full border px-3 py-1.5 text-[13px] font-medium",
                      event.visibility === option.value
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-surface text-ink-soft hover:border-line-strong",
                    )}
                  >
                    {option.label}
                  </button>
                </form>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-ink-mute">
              {VISIBILITIES.find((v) => v.value === event.visibility)?.hint}
            </p>
          </div>

          <form action={setApprovalAction} className="flex items-start gap-3">
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="requiresApproval" value={event.requiresApproval ? "off" : "on"} />
            <button
              type="submit"
              role="switch"
              aria-checked={event.requiresApproval}
              className={cx(
                "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
                event.requiresApproval ? "bg-clay" : "bg-line-strong",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-[left]",
                  event.requiresApproval ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
            <span>
              <span className="block text-sm font-medium text-ink">Approve registrations</span>
              <span className="block text-[13px] text-ink-mute">
                {event.requiresApproval
                  ? "People ask to join; you confirm each one from Overview. When it's full, the rest join a waitlist."
                  : "Anyone can register until it's full; after that they join a waitlist and move up as spots open."}
              </span>
            </span>
          </form>
        </Card>
      </section>

      <section>
        <SectionHeading title="Share the link" hint="Works in a story, a group chat, a poster." />
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-sunk px-3 py-2 text-[13px] text-ink">
              {link}
            </code>
            <CopyButton text={link} label="Copy link" />
            <ButtonLink href={`/e/${event.id}`} variant="ghost" size="sm">
              Open ↗
            </ButtonLink>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Paste-ready</p>
            <pre className="rounded-lg border border-line bg-surface px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
              {blurb}
            </pre>
            <div className="mt-2">
              <CopyButton text={blurb} label="Copy text" />
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading title="QR code" hint="Scans straight to the event page." />
        <Card className="p-5">
          <div
            className="mx-auto w-full max-w-[240px] rounded-lg bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
            // qrcode's SVG is generated from the link we built above, not user input.
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <p className="mt-3 text-center text-[13px] text-ink-mute">
            Right-click to save it for a poster.
          </p>
        </Card>
      </section>
    </div>
  );
}
