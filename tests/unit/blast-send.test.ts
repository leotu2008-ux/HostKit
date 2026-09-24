import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guestFindMany: vi.fn(),
  blastCreate: vi.fn(),
  eventFind: vi.fn(),
  sendEmails: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    guest: { findMany: mocks.guestFindMany },
    blast: { create: mocks.blastCreate },
    event: { findUnique: mocks.eventFind },
  },
}));

vi.mock("@/lib/email/send", () => ({
  isEmailConfigured: () => true,
  sendEmails: mocks.sendEmails,
}));

vi.mock("@/lib/sms/twilio", () => ({
  isSmsConfigured: () => false,
  sendSms: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({ notify: mocks.notify }));

import { emailText, sendBlast } from "@/lib/blast-send";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blastCreate.mockResolvedValue({ id: "b1" });
  mocks.eventFind.mockResolvedValue({ title: "Supper club" });
  mocks.sendEmails.mockImplementation(async (emails: unknown[]) => emails.length);
});

describe("emailText", () => {
  it("personalises the message and signs it with the host and the night", () => {
    expect(emailText("Hi {name}, doors at 7.\n", "Ada Lovelace", "Sam", "Supper club")).toBe(
      "Hi Ada, doors at 7.\n\n— Sam via Hosty. Reply to this email to stop getting updates about Supper club.",
    );
  });
});

describe("sendBlast", () => {
  it("sends every copy on the blast stream, so RESEND_FROM_BLAST applies", async () => {
    mocks.guestFindMany.mockResolvedValue([
      { name: "Ada Lovelace", email: "ada@example.com", rsvpStatus: "ATTENDING", userId: null, user: null },
      { name: "Alan", email: "alan@example.com", rsvpStatus: "ATTENDING", userId: null, user: null },
    ]);

    await sendBlast({
      eventId: "e1",
      host: { name: "Sam", email: "sam@example.com" },
      segment: "going",
      subject: "Doors at 7",
      body: "Hi {name}, doors at 7.",
    });

    expect(mocks.sendEmails).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmails.mock.calls[0][0]).toEqual([
      {
        to: "ada@example.com",
        subject: "Doors at 7",
        text: "Hi Ada, doors at 7.\n\n— Sam via Hosty. Reply to this email to stop getting updates about Supper club.",
        replyTo: "sam@example.com",
        stream: "blast",
        template: "blast",
      },
      {
        to: "alan@example.com",
        subject: "Doors at 7",
        text: "Hi Alan, doors at 7.\n\n— Sam via Hosty. Reply to this email to stop getting updates about Supper club.",
        replyTo: "sam@example.com",
        stream: "blast",
        template: "blast",
      },
    ]);
  });

  it("won't send to Came before the night has happened", async () => {
    mocks.eventFind.mockResolvedValue({
      title: "Supper club",
      date: new Date(Date.now() + 86_400_000),
      endDate: null,
      status: "PLANNING",
    });
    mocks.guestFindMany.mockResolvedValue([
      { name: "Ada", email: "ada@example.com", rsvpStatus: "ATTENDING", checkedInAt: new Date(), userId: null, user: null },
    ]);

    await expect(
      sendBlast({
        eventId: "e1",
        host: { name: "Sam", email: "sam@example.com" },
        segment: "came",
        subject: "Thanks",
        body: "Thanks for coming, {name}.",
      }),
    ).rejects.toThrow(/after the night/);
    expect(mocks.sendEmails).not.toHaveBeenCalled();
    expect(mocks.blastCreate).not.toHaveBeenCalled();
  });
});
