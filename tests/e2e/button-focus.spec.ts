import { expect, test } from "@playwright/test";
import { SPLASH_STORAGE_KEY } from "../../lib/splash";

// The landing is on the public black theme, where the app-wide focus ring is
// black — so a blue ring here can only be the button's own.
test("a keyboard-focused button keeps its pill and shows the brand-blue ring", async ({
  page,
}) => {
  await page.addInitScript((key) => sessionStorage.setItem(key, "1"), SPLASH_STORAGE_KEY);
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Join the waitlist" }).last();
  await expect(cta).toBeVisible();
  const restingRadius = await cta.evaluate((el) => getComputedStyle(el).borderRadius);

  for (let i = 0; i < 40 && !(await cta.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(cta).toBeFocused();

  const ring = await cta.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.outlineColor, offset: s.outlineOffset, radius: s.borderRadius };
  });
  expect(ring).toEqual({ color: "rgb(29, 78, 216)", offset: "3px", radius: restingRadius });
});
