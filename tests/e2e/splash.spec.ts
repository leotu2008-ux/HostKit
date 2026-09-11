import { expect, test } from "@playwright/test";
import { SPLASH_STORAGE_KEY } from "../../lib/splash";

test("plays the launch splash once, then reveals Discover", async ({ page }) => {
  await page.goto("/");

  const splash = page.getByTestId("launch-splash");
  await expect(splash).toBeVisible();
  await expect(splash.locator("img.launch-splash-logo")).toHaveAttribute(
    "src",
    /HostKit_Logo/,
  );
  await expect(splash).toBeHidden({ timeout: 3000 });

  await expect(page.getByRole("heading", { name: "Your events" })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate((key) => sessionStorage.getItem(key), SPLASH_STORAGE_KEY),
    )
    .toBe("1");

  await page.reload();
  await expect(page.getByTestId("launch-splash")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Your events" })).toBeVisible();
});

test("skips the splash when the user prefers reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByTestId("launch-splash")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Your events" })).toBeVisible();
});
