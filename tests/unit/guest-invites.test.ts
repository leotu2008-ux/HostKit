import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendEmails: vi.fn(async (emails: unknown[]) => emails.length),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmails: mocks.sendEmails,
}));

import { deliverRsvpInvites } from "@/lib/guest-invite-send";
import {
  inviteRecipients,
  inviteResultCopy,
  rsvpInviteMessage,
  rsvpUrl,
  type InviteGuest,
} from "@/lib/guest-invites";

function guest(overrides: Partial<InviteGuest> & Pick<InviteGuest, "id">): InviteGuest {
  return {
    name: overrides.name ?? overrides.id,
    email: overrides.email === undefined ? `${overrides.id}@example.com` : overrides.email,
    rsvpToken: overrides.rsvpToken ?? `token-${overrides.id}`,
    ...overrides,
  };
}

const WHEN = new Date(Date.UTC(2026, 5, 15, 23, 30));

describe("inviteRecipients", () => {
  it("skips guests with no email and keeps everyone else", () => {
    const selected = inviteRecipients([
      guest({ id: "ada", name: "Ada", email: "ada@example.com" }),
      guest({ id: "blank", email: "" }),
      guest({ id: "spaces", email: "   " }),
      guest({ id: "none", email: null }),
      guest({ id: "alan", name: "Alan", email: "alan@example.com" }),
    ]);

    expect(selected.skippedNoEmail).toBe(3);
    expect(selected.recipients.map((r) => r.email)).toEqual(["ada@example.com", "alan@example.com"]);
  });

  it("emails an address only once, keeping the first guest's link", () => {
    const selected = inviteRecipients([
      guest({ id: "first", name: "Ada", email: " Ada@Example.com ", rsvpToken: "first-token" }),
      guest({ id: "second", name: "Ada Again", email: "ada@example.com", rsvpToken: "second-token" }),
      guest({ id: "third", name: "Ada Third", email: "ADA@example.com", rsvpToken: "third-token" }),
    ]);

    expect(selected.skippedNoEmail).toBe(0);
    expect(selected.recipients).toHaveLength(1);
    expect(selected.recipients[0]).toMatchObject({
      email: "ada@example.com",
      guest: { id: "first", rsvpToken: "first-token" },
    });
  });
});

describe("rsvpInviteMessage", () => {
  const message = rsvpInviteMessage({
    title: "Spring mixer",
    date: WHEN,
    hostName: "Sam Chen",
    guestName: "Ada Lovelace",
    link: "https://tryhosty.app/rsvp/abc123",
  });

  it("includes the title, date, time, host, and RSVP link in text and html", () => {
    for (const part of [message.text, message.html]) {
      expect(part).toContain("Spring mixer");
      expect(part).toContain("June 15, 2026");
      expect(part).toMatch(/11:30\s*PM/);
      expect(part).toContain("Sam Chen");
      expect(part).toContain("https://tryhosty.app/rsvp/abc123");
    }
    expect(message.subject).toBe("You're invited to Spring mixer");
    expect(message.text).toContain("RSVP:");
    expect(message.html).toContain('href="https://tryhosty.app/rsvp/abc123"');
  });

  it("names the date and the time even when the host hasn't set them", () => {
    const open = rsvpInviteMessage({
      title: "Spring mixer",
      date: null,
      hostName: "Sam Chen",
      guestName: "Ada",
      link: "https://tryhosty.app/rsvp/abc123",
    });
    expect(open.text).toContain("Date: Date to be announced");
    expect(open.text).toContain("Time: Time to be announced");

    const noon = rsvpInviteMessage({
      title: "Spring mixer",
      date: new Date(Date.UTC(2026, 5, 15, 12, 0)),
      hostName: "Sam Chen",
      guestName: "Ada",
      link: "https://tryhosty.app/rsvp/abc123",
    });
    expect(noon.text).toContain("June 15, 2026");
    expect(noon.text).toContain("Time: Time to be announced");
    expect(noon.text).not.toMatch(/12:00/);
  });

  it("does not mention the event budget or any money figure", () => {
    const budgetTotalCents = 250_000;
    const ticketPriceCents = 1_500;
    const body = `${message.subject}\n${message.text}\n${message.html}`;

    expect(budgetTotalCents).toBe(250_000);
    expect(ticketPriceCents).toBe(1_500);
    expect(body).not.toContain(String(budgetTotalCents));
    expect(body).not.toContain(String(ticketPriceCents));
    expect(body).not.toContain("2,500");
    expect(body).not.toContain("15.00");
    expect(body).not.toMatch(/\$/);
    expect(body).not.toMatch(/budget|cents|dollar|price|ticket|payment|\bcost\b/i);
  });
});

describe("deliverRsvpInvites", () => {
  beforeEach(() => {
    mocks.sendEmails.mockClear();
    mocks.sendEmails.mockImplementation(async (emails: unknown[]) => emails.length);
  });

  it("sends one email per address and skips the rest", async () => {
    const result = await deliverRsvpInvites({
      guests: [
        guest({ id: "ada", name: "Ada Lovelace", email: "ada@example.com", rsvpToken: "tok-ada" }),
        guest({ id: "ada-2", name: "Ada Duplicate", email: "ADA@example.com", rsvpToken: "tok-dup" }),
        guest({ id: "sam", name: "Sam", email: null, rsvpToken: "tok-sam" }),
      ],
      title: "Spring mixer",
      date: WHEN,
      hostName: "Sam Chen",
      origin: "https://tryhosty.app/",
      replyTo: "sam@example.com",
    });

    expect(result).toEqual({ sent: 1, skippedNoEmail: 1 });
    expect(mocks.sendEmails).toHaveBeenCalledTimes(1);
    const emails = mocks.sendEmails.mock.calls[0][0] as Array<{
      to: string;
      text: string;
      html: string;
      template: string;
    }>;
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("ada@example.com");
    expect(emails[0].template).toBe("rsvp_invite");
    expect(emails[0].text).toContain(rsvpUrl("https://tryhosty.app/", "tok-ada"));
    expect(emails[0].text).not.toContain("tok-dup");
    expect(emails[0].html).toContain("https://tryhosty.app/rsvp/tok-ada");
    expect(JSON.stringify(emails[0])).not.toMatch(/budget|\$|250000/);
  });

  it("does not call the mailer when nobody has an email", async () => {
    const result = await deliverRsvpInvites({
      guests: [guest({ id: "sam", email: null })],
      title: "Spring mixer",
      date: null,
      hostName: "Sam Chen",
      origin: "https://tryhosty.app",
    });
    expect(result).toEqual({ sent: 0, skippedNoEmail: 1 });
    expect(mocks.sendEmails).not.toHaveBeenCalled();
  });
});

describe("inviteResultCopy", () => {
  it("tells the host how many went out and how many had no email", () => {
    expect(inviteResultCopy(1, 0)).toBe("Sent 1 invite. Skipped 0 guests with no email.");
    expect(inviteResultCopy(3, 2)).toBe("Sent 3 invites. Skipped 2 guests with no email.");
    expect(inviteResultCopy(0, 1)).toBe("Sent 0 invites. Skipped 1 guest with no email.");
  });
});
