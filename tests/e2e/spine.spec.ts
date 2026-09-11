import { expect, test, type Page } from "@playwright/test";
import { SPLASH_STORAGE_KEY } from "../../lib/splash";

/**
 * The spine: everything HostKit claims to do, in the order a host does it.
 *
 * This is deliberately one long test rather than several short ones. The
 * product's whole claim is that these steps are connected — that booking a
 * venue moves the budget and ticks the plan — and that claim is only tested
 * by walking the connection end to end.
 */

const PASSWORD = "correcthorse1";

/** Skip the first-load splash so actionability checks aren't blocked by it. */
async function skipLaunchSplash(page: Page) {
  await page.addInitScript((key: string) => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // Ignore quota / private-mode failures; the test still proceeds.
    }
  }, SPLASH_STORAGE_KEY);
}

async function signUp(page: Page) {
  await skipLaunchSplash(page);
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.fill('input[name="name"]', "Dana Hart");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === "/events" || url.pathname.startsWith("/events/claim") || url.pathname === "/events");
  await page.waitForURL("**/events");
  return email;
}

async function createWedding(page: Page) {
  await page.goto("/events/new");
  await page.click('button:has-text("Wedding")');
  const date = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
  await page.fill('input[name="date"]', date);
  await page.fill('input[name="title"]', "Sam & Ali's wedding");
  await page.fill('input[name="time"]', "18:00");
  await page.fill('input[name="address"]', "200 Kent Ave, Brooklyn, NY");
  await page.fill('input[name="guestCount"]', "90");
  await page.fill('input[name="budget"]', "48,000");
  await page.click('button:has-text("Save this night")');
  await page.waitForURL((url) => /\/events\/[a-z0-9]{8,}$/.test(url.pathname));
  return page.url();
}

test("a host can plan, scout, shortlist and book an event", async ({ page }) => {
  await signUp(page);
  const event = await createWedding(page);

  await test.step("intake generates a budget and a timeline", async () => {
    await page.goto(`${event}/plan`);
    await expect(page.getByText("of $48,000")).toBeVisible();
    // Required categories start out unbooked.
    await expect(page.getByText("4 essential bookings outstanding")).toBeVisible();

    // Per-category allocations live on the budget page. 32% of $48,000 is
    // the wedding template's venue share. It appears twice there — the row
    // and the "nothing booked yet" note — hence .first().
    await page.goto(`${event}/budget`);
    await expect(page.getByText("$15,360").first()).toBeVisible();
  });

  await test.step("the timeline is anchored to the event date", async () => {
    await page.goto(`${event}/plan`);
    await expect(page.getByText("Book the venue")).toBeVisible();
    await expect(page.getByText("Confirm final headcount with the caterer")).toBeVisible();
  });

  await test.step("discovery prices listings for this event", async () => {
    await page.goto(`${event}/discover`);
    await expect(
      page.getByText(/priced for 90 guests over 8 hours/),
    ).toBeVisible();

    // The filter panel starts collapsed so results come first; open it.
    await page.locator('summary:has-text("Filters")').click();

    // Filtering to venues narrows the results.
    await page.locator('button[aria-pressed]:has-text("Venue")').first().click();
    await page.waitForFunction(() => location.search.includes("category=VENUE"));
    await expect(page.getByText(/of 8 in New York/)).toBeVisible();

    // Listings that cannot work are hidden by default, and revealed on demand.
    const fitted = await page.locator("article").count();
    await page.locator('input[type="checkbox"]').uncheck();
    await page.waitForFunction(() => location.search.includes("unfit=show"));
    expect(await page.locator("article").count()).toBeGreaterThan(fitted);
  });

  await test.step("a venue can be shortlisted and compared", async () => {
    await page.goto(`${event}/discover?category=VENUE`);
    await page.locator('article button[aria-label*="shortlist"]').first().click();
    await page.goto(`${event}/shortlist`);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("for your 8 hours").first()).toBeVisible();
  });

  await test.step("the inquiry is drafted with the event's details", async () => {
    await page.locator("tbody tr td a").first().click();
    await page.waitForURL(/\/listings\//);
    await page.click('button:has-text("Draft an inquiry")');
    const message = page.locator('textarea[name="message"]');
    await expect(message).toBeVisible();

    const body = await message.inputValue();
    expect(body).toContain("90 guests");
    expect(body).toContain("8 hours");
    expect(body).toContain("New York, NY");
    // The budget is never disclosed to a vendor.
    expect(body).not.toMatch(/\$/);
  });

  await test.step("booking without a price is refused", async () => {
    await page.selectOption('select[name="status"]', "BOOKED");
    await page.click('button:has-text("Save")');
    await expect(
      page.getByText("Add the agreed price before marking this booked."),
    ).toBeVisible();
    await expect(page.locator('select[name="status"]')).toHaveValue("DRAFT");
  });

  await test.step("booking writes back to the budget and closes the task", async () => {
    await page.fill('input[name="quoted"]', "7,500");
    await page.selectOption('select[name="status"]', "BOOKED");
    await page.click('button:has-text("Save")');
    await expect(page.locator('select[name="status"]')).toHaveValue("BOOKED");

    await page.goto(`${event}/budget`);
    await expect(page.getByText("$7,500").first()).toBeVisible();

    await page.goto(`${event}/plan`);
    await expect(page.locator('p.line-through:has-text("Book the venue")')).toBeVisible();

    await page.goto(`${event}/plan`);
    await expect(page.getByText("3 essential bookings outstanding")).toBeVisible();
  });

  await test.step("declining the booking takes the money back out", async () => {
    await page.goto(`${event}/shortlist`);
    await page.locator("tbody tr td a").first().click();
    await page.waitForURL(/\/listings\//);
    await page.selectOption('select[name="status"]', "DECLINED");
    await page.click('button:has-text("Save")');
    await expect(page.locator('select[name="status"]')).toHaveValue("DECLINED");

    await page.goto(`${event}/budget`);
    await expect(page.getByText("Committed so far")).toBeVisible();
    await expect(page.getByText("$0").first()).toBeVisible();
  });
});
