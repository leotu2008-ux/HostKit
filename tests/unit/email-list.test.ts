import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailSendError } from "@/lib/email/send";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  sendEmails: vi.fn(),
  isEmailConfigured: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { emailListEntry: { upsert: mocks.upsert } },
}));

vi.mock("@/lib/email/send", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/send")>("@/lib/email/send");
  return {
    ...actual,
    sendEmails: mocks.sendEmails,
    isEmailConfigured: mocks.isEmailConfigured,
  };
});

import { joinEmailList } from "@/lib/email-list";

beforeEach(() => {
  mocks.upsert.mockReset().mockResolvedValue({});
  mocks.sendEmails.mockReset().mockResolvedValue(1);
  mocks.isEmailConfigured.mockReset().mockReturnValue(true);
});

describe("joinEmailList", () => {
  it("records the address and sends a confirmation", async () => {
    await expect(joinEmailList({ name: "Avery Lane", email: "Avery@Example.com" })).resolves.toEqual({
      email: "avery@example.com",
    });

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { email: "avery@example.com" },
      create: { email: "avery@example.com", name: "Avery Lane" },
      update: { name: "Avery Lane" },
    });
    expect(mocks.sendEmails).toHaveBeenCalledWith([
      {
        to: "avery@example.com",
        subject: "Thanks for joining the Hosty waitlist",
        text: ["Hi Avery,", "", "Thanks for joining the waitlist! We’ll keep you posted whenever updates happen."].join(
          "\n",
        ),
      },
    ]);
  });

  it("refuses when the confirmation cannot be delivered", async () => {
    mocks.sendEmails.mockRejectedValue(new EmailSendError(550, "no such user", "smtp"));
    await expect(joinEmailList({ name: "Avery", email: "avery@example.com" })).rejects.toThrow(
      /couldn’t send the confirmation email to avery@example.com/i,
    );
  });

  it("still lists them in development when email is not configured", async () => {
    mocks.isEmailConfigured.mockReturnValue(false);
    await expect(joinEmailList({ name: "Avery", email: "avery@example.com" })).resolves.toEqual({
      email: "avery@example.com",
    });
    expect(mocks.sendEmails).not.toHaveBeenCalled();
  });
});
