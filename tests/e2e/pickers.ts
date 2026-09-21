import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Driving the Brief tab's three custom pickers.
 *
 * `page.fill` used to be enough: date, start and city were a native date
 * input, a native time input and a Select. They're a month grid
 * (components/calendar-picker.tsx), three scroll drums
 * (components/time-wheel.tsx) and a typeahead (components/city-field.tsx)
 * now — the fields they submit are unchanged, which is exactly what these
 * helpers assert on the way past.
 *
 * Shared by both create helpers so the spine and the door-signal walk press
 * the same buttons; everything either spec does after the brief is untouched.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** The `data-date` a calendar cell carries, in local time. */
function key(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** One labelled Field on the Brief tab, by the form field inside it. A label
 *  for a plain input, a named group for a composite picker — see Field in
 *  components/ui.tsx. */
function field(page: Page, name: string): Locator {
  return page
    .locator('label, [role="group"]')
    .filter({ has: page.locator(`input[name="${name}"]`) });
}

/** Pages the calendar forward to `target`'s month and picks the day. */
export async function pickDate(page: Page, target: Date) {
  const cell = page.locator(`button[data-date="${key(target)}"]`);
  const next = page.getByRole("button", { name: "Next month" });
  // The grid opens on this month and shows six weeks, so a date inside the
  // next fortnight may already be on it. 12 presses covers a year out.
  for (let i = 0; i < 12 && !(await cell.isVisible()); i += 1) {
    await next.click();
  }
  await cell.click();

  await expect(page.locator('input[name="date"]')).toHaveValue(key(target));
  // The date in words, which is the whole point of the grid.
  await expect(field(page, "date").getByText(new RegExp(`, ${target.getFullYear()}$`))).toBeVisible();
}

/** Spins the three drums to a 12-hour time, and checks the 24h field. */
export async function pickTime(page: Page, hour: number, minute: number, meridiem: "AM" | "PM") {
  const wheel = field(page, "time");
  await wheel.locator(`[data-hour="${hour}"]`).click();
  await wheel.locator(`[data-minute="${minute}"]`).click();
  await wheel.locator(`[data-meridiem="${meridiem}"]`).click();

  const h24 = meridiem === "PM" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  await expect(page.locator('input[name="time"]')).toHaveValue(`${pad(h24)}:${pad(minute)}`);
}

/** Types a city and closes the suggestion popover, leaving the typed text as
 *  the submitted value — the field is the input itself, not a mirror. */
export async function pickCity(page: Page, city: string) {
  const input = page.locator('input[name="city"]');
  await page.fill('input[name="city"]', city);
  await input.press("Escape");
  await expect(input).toHaveValue(city);
}
