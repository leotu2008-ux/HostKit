import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guestFindMany: vi.fn(),
  blastCreate: vi.fn(),
  eventFind: vi.fn(),
  sendEmails: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    guest: { findMany: mocks.guestFindMany },
    blast: { create: mocks.blastCreate, findMany: vi.fn(async () => []) },
    event: { findUnique: mocks.eventFind },
  },
}));

vi.mock("@/lib/api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/http")>();
  return {
    ...actual,
    apiUser: vi.fn(async () => ({ id: "u1", name: "Sam", email: "sam@example.com" })),
    manageableEvent: vi.fn(async () => ({ id: "e1", date: null, endDate: null, status: "PLANNING" })),
  };
});

vi.mock("@/lib/email/send", () => ({
  isEmailConfigured: () => true,
  sendEmails: mocks.sendEmails,
}));

vi.mock("@/lib/sms/twilio", () => ({
  isSmsConfigured: () => false,
  sendSms: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

import { POST } from "@/app/api/v1/events/[id]/blasts/route";

function post(segment: string) {
  return POST(
    new Request("http://localhost/api/v1/events/e1/blasts", {
      method: "POST",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify({ segment, subject: "Thanks", body: "Thanks for coming, {name}." }),
    }),
    { params: Promise.resolve({ id: "e1" }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventFind.mockResolvedValue({
    title: "Supper club",
    date: new Date(Date.now() + 86_400_000),
    endDate: null,
    status: "PLANNING",
  });
  mocks.guestFindMany.mockResolvedValue([
    { name: "Ada", email: "ada@example.com", rsvpStatus: "ATTENDING", checkedInAt: new Date(), userId: null, user: null },
  ]);
});

describe("POST /api/v1/events/:id/blasts", () => {
  it("answers a Came blast before the night with a 409, not a server error", async () => {
    const res = await post("came");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "“Came” opens after the night, once guests were checked in at the door.",
    });
    expect(mocks.sendEmails).not.toHaveBeenCalled();
    expect(mocks.blastCreate).not.toHaveBeenCalled();
  });
});
