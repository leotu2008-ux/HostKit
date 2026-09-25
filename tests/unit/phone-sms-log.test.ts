import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: false,
  dbCalls: 0,
}));

vi.mock("@/lib/sms/twilio", () => ({
  isSmsConfigured: () => state.configured,
  sendSms: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findFirst: () => {
        state.dbCalls += 1;
        return Promise.resolve(null);
      },
    },
    phoneVerification: {
      findFirst: () => Promise.resolve(null),
      deleteMany: () => Promise.resolve({ count: 0 }),
      create: () => Promise.resolve({}),
    },
    $transaction: (ops: Array<Promise<unknown>>) => Promise.all(ops),
  },
}));

import { PhoneError, startPhoneVerification } from "@/lib/phone";

const PHONE = "(617) 555-0100";
const E164 = "+16175550100";

describe("SMS verification without Twilio", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    state.configured = false;
    state.dbCalls = 0;
  });

  async function expectClosed() {
    state.dbCalls = 0;
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = await startPhoneVerification("user_1", PHONE).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PhoneError);
    expect((error as PhoneError).message).toMatch(/isn't configured/i);
    expect((error as PhoneError).message).not.toContain(E164);
    expect((error as PhoneError).message).not.toContain("617");
    expect((error as PhoneError).status).toBe(503);
    expect(state.dbCalls).toBe(0);
    const logged = spy.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(logged).not.toContain(E164);
    expect(logged).not.toContain("6175550100");
    expect(logged).not.toMatch(/\b\d{6}\b/);
    expect(spy).not.toHaveBeenCalled();
  }

  it("does not log the number or the code when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.VERCEL_ENV;
    await expectClosed();
  });

  it("does not log the number or the code when VERCEL_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    await expectClosed();
  });

  it("masks the number in the development log", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.VERCEL_ENV;
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await startPhoneVerification("user_1", PHONE);
    expect(result.devCode).toMatch(/^\d{6}$/);
    const logged = spy.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(logged).toContain(result.devCode);
    expect(logged).toContain("+••••0100");
    expect(logged).not.toContain(E164);
    expect(logged).not.toContain("6175550100");
  });
});
