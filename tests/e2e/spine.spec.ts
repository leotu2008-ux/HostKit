import { expect, test, type Page } from "@playwright/test";
import { SPLASH_STORAGE_KEY } from "../../lib/splash";
import { pickCity, pickDate, pickDuration, pickTime } from "./pickers";

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
  // Sign-up waits for the confirmation link. Without an email service the
  // dev server hands the link back; opening it lands on sign-in.
  await page.getByText("Check your inbox").waitFor();
  await page.click('a:has-text("open it")');
  await page.waitForURL(/\/signin\?verified=1/);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/events");
  return email;
}

// This night is deliberately planned from the dinner-party template, chosen
// by typing a kind eventTypeForKind maps to DINNER_PARTY: catering is the
// one essential booking.
async function createNight(page: Page) {
  await page.goto("/events");
  await page.click('button:has-text("Create event")');
  await page.waitForURL((url) => /\/events\/[a-z0-9]{8,}$/.test(url.pathname));
  const event = page.url();

  // The sidebar's own "Brief" tab, not the header's "Finish the brief" link.
  await page.getByRole("link", { name: "Brief", exact: true }).click();
  await page.fill('input[name="title"]', "Sam & Ali's supper");
  await page.fill('input[name="kind"]', "dinner party");
  await pickDate(page, new Date(Date.now() + 200 * 86_400_000));
  await pickTime(page, 6, 0, "PM");
  await pickDuration(page, 8, 0);
  await pickCity(page, "New York, NY");
  await page.fill('input[name="guestCount"]', "90");
  await page.fill('input[name="budget"]', "48,000");
  // The venue step is optional; this host already has a place.
  await page.click('summary:has-text("I already have a venue")');
  await page.fill('input[name="address"]', "200 Kent Ave, Brooklyn, NY");
  await page.click('button:has-text("Save the brief")');
  await expect(page.getByText("Saved.")).toBeVisible();

  // A complete brief starts the agent behind the response (after()), so the
  // plan and budget every later step asserts on are its work, not the save's.
  // Deterministic without ANTHROPIC_API_KEY: draftPlan's fallback is the same
  // template, so it writes the same categories and tasks either way.
  await page.goto(event);
  await expect(page.getByText("Plan drafted")).toBeVisible({ timeout: 30_000 });
  return event;
}

test("a host can plan, scout, shortlist and book an event", async ({ page }) => {
  await signUp(page);
  const event = await createNight(page);

  await test.step("the Overview's activity feed shows what just happened", async () => {
    await page.goto(event);
    await expect(page.getByText("Event created")).toBeVisible();
    await expect(page.getByText("Brief updated")).toBeVisible();
  });

  await test.step("publishing shows up live in the feed, in a second tab too", async () => {
    // Already on the Overview from the previous step, with the header's
    // Publish button available (the brief is complete and we're signed in).
    // A second, already-open tab proves this is the poll picking it up, not
    // something special about the tab that submitted the form.
    const second = await page.context().newPage();
    await second.goto(event);

    await page.click('button:has-text("Publish")');
    await expect(page.getByText("Published — guests can register")).toBeVisible({ timeout: 15_000 });
    await expect(second.getByText("Published — guests can register")).toBeVisible({ timeout: 15_000 });
    await second.close();
  });

  await test.step("intake generates a budget and a timeline", async () => {
    await page.goto(`${event}/plan`);
    await expect(page.getByText("of $48,000")).toBeVisible();
    // Required categories start out unbooked.
    await expect(page.getByText("1 essential booking outstanding")).toBeVisible();
  });

  await test.step("the timeline is anchored to the event date", async () => {
    await page.goto(`${event}/plan`);
    await expect(page.getByText("Book the caterer")).toBeVisible();
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

  // Captured on the discover card so every later step can pick the host's own
  // venue out of a shortlist the agent has also been adding to.
  let venueName = "";
  const venueRow = () => page.locator("tbody tr").filter({ hasText: venueName });

  await test.step("a venue can be shortlisted and compared", async () => {
    await page.goto(`${event}/discover?category=VENUE`);
    const card = page.locator("article").first();
    venueName = (await card.locator("h3").innerText()).trim();
    await card.locator('button[aria-label*="shortlist"]').click();

    await page.goto(`${event}/shortlist`);
    // The agent shortlists the vendors it drafted inquiries to, so this
    // asserts the host's venue is on the list — not that it's alone on it.
    await expect(venueRow()).toHaveCount(1);
    await expect(venueRow().getByText("for your 8 hours")).toBeVisible();
  });

  await test.step("the inquiry is drafted with the event's details", async () => {
    await venueRow().locator("td a").first().click();
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

  await test.step("booking writes back to the budget", async () => {
    await page.fill('input[name="quoted"]', "7,500");
    await page.selectOption('select[name="status"]', "BOOKED");
    await page.click('button:has-text("Save")');
    await expect(page.locator('select[name="status"]')).toHaveValue("BOOKED");

    await page.goto(`${event}/budget`);
    await expect(page.getByText("$7,500").first()).toBeVisible();
  });

  await test.step("declining the booking takes the money back out", async () => {
    await page.goto(`${event}/shortlist`);
    await venueRow().locator("td a").first().click();
    await page.waitForURL(/\/listings\//);
    await page.selectOption('select[name="status"]', "DECLINED");
    await page.click('button:has-text("Save")');
    await expect(page.locator('select[name="status"]')).toHaveValue("DECLINED");

    await page.goto(`${event}/budget`);
    await expect(page.getByText("Committed so far")).toBeVisible();
    await expect(page.getByText("$0").first()).toBeVisible();
  });
});
