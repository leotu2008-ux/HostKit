"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addTierAction,
  buyTicketsAction,
  scanAction,
  type BuyFormState,
  type DoorState,
  type TierFormState,
} from "@/lib/actions/tickets";
import { Button, Field, FormError, Input, cx } from "@/components/ui";
import { formatCents } from "@/lib/money";

function Submit({ label, size = "md" }: { label: string; size?: "sm" | "md" | "lg" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} disabled={pending}>
      {pending ? "One moment…" : label}
    </Button>
  );
}

/** Organiser: put a ticket on sale. */
export function AddTierForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState<TierFormState, FormData>(addTierAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <FormError>{state?.error}</FormError>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name">
          <Input name="name" placeholder="General" required maxLength={60} />
        </Field>
        <Field label="Price" hint="Leave blank for free.">
          <Input name="price" inputMode="decimal" placeholder="15.00" />
        </Field>
        <Field label="How many">
          <Input name="quantity" type="number" min={1} defaultValue={100} required />
        </Field>
      </div>
      <Submit label="Put on sale" size="sm" />
    </form>
  );
}

export type BuyTier = { id: string; name: string; priceCents: number; left: number };

/** Buyer: no account, just who you are and how many. */
export function BuyTicketsForm({ eventId, tiers }: { eventId: string; tiers: BuyTier[] }) {
  const [state, action] = useActionState<BuyFormState, FormData>(buyTicketsAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <FormError>{state?.error}</FormError>

      <div className="space-y-2">
        {tiers.map((tier) => (
          <div key={tier.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-medium text-ink">{tier.name}</p>
              <p className="text-[13px] text-ink-soft">
                {tier.priceCents === 0 ? "Free" : formatCents(tier.priceCents)}
                {tier.left <= 10 ? ` · ${tier.left} left` : ""}
              </p>
            </div>
            <Input
              name={`qty_${tier.id}`}
              type="number"
              min={0}
              max={Math.min(tier.left, 10)}
              defaultValue={0}
              aria-label={`How many ${tier.name}`}
              className="w-20 shrink-0"
            />
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name">
          <Input name="name" autoComplete="name" required maxLength={80} />
        </Field>
        <Field label="Email" hint="Where the tickets go.">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
      </div>

      <Submit label="Get tickets" size="lg" />
      <p className="text-[12px] text-ink-mute">
        You’ll get a link with your tickets. The organiser settles payment with you directly.
      </p>
    </form>
  );
}

const VERDICT: Record<string, { text: string; tone: string }> = {
  ok: { text: "Let them in", tone: "border-forest bg-forest-wash text-forest" },
  already: { text: "Already scanned", tone: "border-amber bg-amber-wash text-amber" },
  unpaid: { text: "Not paid yet", tone: "border-amber bg-amber-wash text-amber" },
  void: { text: "Void — refunded or cancelled", tone: "border-danger bg-danger-wash text-danger" },
  "wrong-event": { text: "That ticket is for another night", tone: "border-danger bg-danger-wash text-danger" },
  "not-found": { text: "No such ticket", tone: "border-danger bg-danger-wash text-danger" },
};

/**
 * The door. One box that takes a scan or a typed code, and one big answer —
 * this gets used one-handed, in the dark, with a queue.
 */
export function DoorScanner({ eventId }: { eventId: string }) {
  const [state, action] = useActionState<DoorState, FormData>(scanAction, undefined);
  const verdict = state?.outcome?.verdict;
  const look = verdict ? VERDICT[verdict.kind] : null;

  return (
    <div className="space-y-3">
      <form action={action} className="flex gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <Input
          name="token"
          placeholder="Scan a ticket, or type its code"
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 text-[17px]"
        />
        <Submit label="Check" />
      </form>

      <FormError>{state?.error}</FormError>

      {verdict && look ? (
        <div className={cx("rounded-card border-2 px-4 py-4", look.tone)}>
          <p className="text-[22px] font-semibold">{look.text}</p>
          {state?.outcome?.holder ? (
            <p className="mt-1 text-[15px]">
              {state.outcome.holder}
              {state.outcome.tierName ? ` · ${state.outcome.tierName}` : ""}
            </p>
          ) : null}
          {verdict.kind === "already" ? (
            <p className="mt-1 text-[13px]">
              First scanned at {new Date(verdict.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
