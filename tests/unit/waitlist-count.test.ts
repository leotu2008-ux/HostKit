import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  cacheOptions: [] as unknown[],
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  joinEmailList: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { emailListEntry: { count: mocks.count } },
}));

// Outside Next there is no cache to hold the result: run the query every
// time, and remember how it asked to be cached.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<number>, keys: string[], options: unknown) => {
    mocks.cacheOptions.push({ keys, options });
    return fn;
  },
  updateTag: mocks.updateTag,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next-auth", () => ({ AuthError: class extends Error {}, CredentialsSignin: class extends Error {} }));
vi.mock("@/lib/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, assertRateLimit: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("@/lib/email-list", () => ({ joinEmailList: mocks.joinEmailList }));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    createElement("img", { src, alt, className }),
}));
vi.mock("@/lib/actions/events", () => ({ createBlankEventAction: vi.fn() }));

import { Landing } from "@/components/landing";
import { WaitlistCount, waitlistCountLabel } from "@/components/waitlist-count";
import { signUpAction } from "@/lib/actions/auth";
import {
  WAITLIST_COUNT_REVALIDATE,
  WAITLIST_COUNT_TAG,
  getWaitlistCount,
} from "@/lib/waitlist-count";

async function landingHtml() {
  const waitlistCount = await getWaitlistCount();
  return renderToStaticMarkup(createElement(Landing, { canCreate: false, waitlistCount }));
}

beforeEach(() => {
  mocks.count.mockReset();
  mocks.updateTag.mockReset();
  mocks.joinEmailList.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("waitlist count", () => {
  it("reads the count with one cached count() query, kept about a minute", async () => {
    mocks.count.mockResolvedValue(142);

    await expect(getWaitlistCount()).resolves.toBe(142);
    expect(mocks.count).toHaveBeenCalledTimes(1);
    expect(mocks.count).toHaveBeenCalledWith();
    expect(mocks.cacheOptions).toContainEqual({
      keys: ["waitlist-count"],
      options: { revalidate: 60, tags: [WAITLIST_COUNT_TAG] },
    });
    expect(WAITLIST_COUNT_REVALIDATE).toBe(60);
  });

  it("shows the exact number under both Join the waitlist buttons", async () => {
    mocks.count.mockResolvedValue(142);
    const html = await landingHtml();

    expect(html.match(/142 people on the waitlist/g)).toHaveLength(2);
    // Each line sits after its button.
    const hero = html.indexOf("Join the waitlist");
    expect(html.indexOf("142 people on the waitlist")).toBeGreaterThan(hero);
    expect(html.lastIndexOf("142 people on the waitlist")).toBeGreaterThan(
      html.lastIndexOf("Join the waitlist"),
    );
  });

  it("writes large counts in full, and one person in the singular", () => {
    expect(waitlistCountLabel(12345)).toBe("12,345 people on the waitlist");
    expect(waitlistCountLabel(1)).toBe("1 person on the waitlist");
  });

  it("hides the line when nobody has joined", async () => {
    mocks.count.mockResolvedValue(0);

    await expect(getWaitlistCount()).resolves.toBe(0);
    expect(waitlistCountLabel(0)).toBeNull();
    const html = await landingHtml();
    expect(html).not.toContain("on the waitlist");
    expect(html).toContain("Join the waitlist");
  });

  it("hides the line and keeps the page up when the query fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.count.mockRejectedValue(new Error("connection refused"));

    await expect(getWaitlistCount()).resolves.toBeNull();
    expect(error).toHaveBeenCalled();
    const html = await landingHtml();
    expect(html).not.toContain("on the waitlist");
    expect(html).toContain("Join the waitlist");
    expect(renderToStaticMarkup(createElement(WaitlistCount, { count: null }))).toBe("");
  });

  it("doesn't show a host with access the count", () => {
    const html = renderToStaticMarkup(createElement(Landing, { canCreate: true, waitlistCount: 142 }));
    expect(html).not.toContain("on the waitlist");
  });
});

describe("joining the waitlist", () => {
  function signUpForm() {
    const form = new FormData();
    form.set("name", "Avery Lane");
    form.set("email", "avery@example.com");
    return form;
  }

  it("expires the cached count and returns the fresh number, and nothing else about the list", async () => {
    mocks.joinEmailList.mockResolvedValue({ email: "avery@example.com" });
    mocks.count.mockResolvedValue(143);

    await expect(signUpAction(undefined, signUpForm())).resolves.toEqual({
      listed: { email: "avery@example.com", waitlistCount: 143 },
    });
    expect(mocks.updateTag).toHaveBeenCalledWith(WAITLIST_COUNT_TAG);
  });

  it("still lists them when the count can't be read afterwards", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.joinEmailList.mockResolvedValue({ email: "avery@example.com" });
    mocks.count.mockRejectedValue(new Error("connection refused"));

    await expect(signUpAction(undefined, signUpForm())).resolves.toEqual({
      listed: { email: "avery@example.com", waitlistCount: null },
    });
  });

  it("leaves the cached count alone when the signup fails", async () => {
    mocks.joinEmailList.mockRejectedValue(new Error("boom"));

    await expect(signUpAction(undefined, signUpForm())).rejects.toThrow("boom");
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
