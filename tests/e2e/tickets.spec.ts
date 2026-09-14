import { expect, test, type Page } from "@playwright/test";
import { SPLASH_STORAGE_KEY } from "../../lib/splash";

const PASSWORD = "e2e-tickets-pass-1";

async function skipLaunchSplash(page: Page) {
  await page.addInitScript((key: string) => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode can throw; the test still proceeds.
    }
  }, SPLASH_STORAGE_KEY);
}

async function signUp(page: Page) {
  await skipLaunchSplash(page);
  const email = `tix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/signup");
  await page.fill('input[name="name"]', "Ada Organiser");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.getByText("Check your inbox").waitFor();
  await page.click('a:has-text("open it")');
  await page.waitForURL(/\/signin\?verified=1/);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/events");
}

async function createAndPublish(page: Page) {
  await page.goto("/events/new");
  const date = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await page.fill('input[name="date"]', date);
  await page.fill('input[name="title"]', "Spring Formal");
  await page.fill('input[name="time"]', "20:00");
  await page.fill('input[name="durationHours"]', "5");
  await page.click('button:has-text("I already have a venue")');
  await page.fill('input[name="address"]', "231 Forest St, Babson Park, MA");
  await page.fill('input[name="guestCount"]', "150");
  await page.fill('input[name="budget"]', "4,000");
  await page.click('button:has-text("Save this night")');
  await page.waitForURL(/\/events\/[a-z0-9]{8,}$/);
  const url = page.url();
  await page.click('button:has-text("Publish")');
  return url.split("/events/")[1];
}

test("a night sells a ticket and tears it at the door", async ({ page, context }) => {
  await signUp(page);
  const eventId = await createAndPublish(page);

  // The organiser puts a ticket on sale.
  await page.goto(`/events/${eventId}/tickets`);
  await page.fill('input[name="name"]', "General");
  await page.fill('input[name="price"]', "15.00");
  await page.fill('input[name="quantity"]', "50");
  await page.click('button:has-text("Put on sale")');
  await expect(page.getByText("0 of 50 gone")).toBeVisible();

  // A buyer, with no account at all, takes two.
  const buyer = await context.newPage();
  await skipLaunchSplash(buyer);
  await buyer.goto(`/e/${eventId}`);
  await expect(buyer.getByText("Tickets", { exact: true })).toBeVisible();
  await buyer.fill('input[aria-label="How many General"]', "2");
  await buyer.fill('input[name="name"]', "Sam Buyer");
  await buyer.fill('input[name="email"]', "sam.buyer@example.com");
  await buyer.click('button:has-text("Get tickets")');

  // They land on their own ticket page, one code per admission.
  await buyer.waitForURL(/\/t\/[a-f0-9]{16,}/);
  await expect(buyer.getByRole("heading", { name: "Spring Formal" })).toBeVisible();
  // Two admissions, so two codes — a group can split up at the door.
  await expect(buyer.locator('[data-testid="ticket-token"]')).toHaveCount(2);
  const code = await buyer.locator('[data-testid="ticket-token"]').first().innerText();
  expect(code).toHaveLength(8);

  // The organiser sees the order, unpaid, and settles it.
  await page.reload();
  await expect(page.getByText("sam.buyer@example.com")).toBeVisible();
  // Two at fifteen: the order totals thirty, and it is owed, not paid.
  const orderRow = page.locator("li", { hasText: "sam.buyer@example.com" }).first();
  await expect(orderRow).toContainText("2 tickets");
  await expect(orderRow).toContainText("$30");
  await expect(page.getByText("Still owed").locator("..")).toContainText("$30");
  await page.click('button:has-text("Mark paid")');
  await expect(page.getByText("paid", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Money in").locator("..")).toContainText("$30");

  // The door. Take the real token off the buyer's page and scan it.
  const token = await buyer.locator('[data-testid="ticket-token"]').first().getAttribute("data-token");
  expect(token).toBeTruthy();
  await page.goto(`/events/${eventId}/check-in`);
  await expect(page.getByText("Scan a ticket")).toBeVisible();
  await page.fill('input[name="token"]', token!);
  await page.click('button:has-text("Check")');
  await expect(page.getByText("Let them in")).toBeVisible();

  // The same code a second time is the thing that must never pass.
  await page.fill('input[name="token"]', token!);
  await page.click('button:has-text("Check")');
  await expect(page.getByText("Already scanned")).toBeVisible();

  // A code that was never sold.
  await page.fill('input[name="token"]', "deadbeefdeadbeefdeadbeef");
  await page.click('button:has-text("Check")');
  await expect(page.getByText("No such ticket")).toBeVisible();
});
