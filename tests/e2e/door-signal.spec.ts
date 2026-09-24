import { expect, test, type Page } from "@playwright/test";
import { SPLASH_STORAGE_KEY } from "../../lib/splash";
import { pickCity, pickDate, pickDuration, pickTime } from "./pickers";

/**
 * The door must not rewrite the guest's answer.
 *
 * Checking someone in used to also set their RSVP to ATTENDING, so a person
 * who never replied and simply turned up became indistinguishable from one who
 * had said yes — and undo left the invented "yes" behind. That erased the only
 * signal worth measuring, silently, on every event ever run.
 *
 * This walks the whole thing in a browser because the bug lived in two write
 * sites, not in a pure function.
 */

async function skipLaunchSplash(page: Page) {
  await page.addInitScript((key: string) => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode throws; the test proceeds either way.
    }
  }, SPLASH_STORAGE_KEY);
}

async function signInAsMaya(page: Page) {
  await skipLaunchSplash(page);
  await page.goto("/signin");
  await page.fill('input[name="email"]', "maya@hosty.demo");
  await page.fill('input[name="password"]', "hosty-demo");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === "/events");
}

async function createNight(page: Page) {
  await page.goto("/events");
  await page.click('button:has-text("Create event")');
  await page.waitForURL((url) => /\/events\/[a-z0-9]{8,}$/.test(url.pathname));
  const event = page.url();

  // The sidebar's own "Brief" tab, not the header's "Finish the brief" link.
  await page.getByRole("link", { name: "Brief", exact: true }).click();
  await page.fill('input[name="title"]', "Door signal night");
  await page.fill('input[name="kind"]', "mixer");
  await pickDate(page, new Date(Date.now() + 14 * 86_400_000));
  await pickTime(page, 7, 0, "PM");
  await pickDuration(page, 4, 0);
  await pickCity(page, "New York, NY");
  await page.fill('input[name="guestCount"]', "40");
  await page.fill('input[name="budget"]', "2,000");
  await page.click('summary:has-text("I already have a venue")');
  await page.fill('input[name="address"]', "231 Forest St, Babson Park, MA");
  await page.click('button:has-text("Save the brief")');
  await expect(page.getByText("Saved.")).toBeVisible();
  return event;
}

/** The status pill on a guest row. The same words appear in the status
 *  dropdown, so matching on text alone is ambiguous. */
function badge(page: Page, label: string) {
  return page.locator("span").filter({ hasText: new RegExp(`^${label}$`) });
}

test("checking someone in never answers the RSVP for them", async ({ page }) => {
  await signInAsMaya(page);
  const event = await createNight(page);

  // A guest the host added by hand, who has not replied.
  await page.goto(`${event}/guests`);
  await page.fill('textarea[name="guests"]', "Morgan Walkup <morgan.walkup@example.com>");
  await page.click('button:has-text("Add to the list")');
  await expect(badge(page, "No reply yet")).toBeVisible();

  // Admit them at the door.
  await page.goto(`${event}/check-in`);
  await page.click('button:has-text("Check in")');
  await expect(page.getByText(/· in /)).toBeVisible();

  // The answer they never gave must still be unanswered.
  await page.goto(`${event}/guests`);
  await expect(badge(page, "No reply yet")).toBeVisible();
  await expect(badge(page, "Coming")).toHaveCount(0);

  // And undoing must not leave an invented "yes" behind.
  await page.goto(`${event}/check-in`);
  // The undo control reads "Already in" — tapping it takes them back out.
  await page.click('button:has-text("Already in")');
  await page.goto(`${event}/guests`);
  await expect(badge(page, "No reply yet")).toBeVisible();
  await expect(badge(page, "Coming")).toHaveCount(0);
});
