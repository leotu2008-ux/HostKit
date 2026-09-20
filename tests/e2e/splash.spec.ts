import { expect, test } from "@playwright/test";
import { SPLASH_STORAGE_KEY } from "../../lib/splash";

// Signed out, "/" is the landing page — so the hero is what proves the page
// rendered once the splash clears.
test("plays the launch splash once, then reveals the landing page", async ({
  page,
}) => {
  await page.goto("/");

  const splash = page.getByTestId("launch-splash");
  await expect(splash).toBeVisible();
  await expect(splash.locator("img.launch-splash-logo")).toHaveAttribute(
    "src",
    /HostKit_Logo/,
  );

  const timings = await splash.evaluate((el) => {
    const logo = el.querySelector(".launch-splash-logo");
    return {
      overlay: getComputedStyle(el).animationDuration,
      logo: logo ? getComputedStyle(logo).animationDuration : "",
    };
  });
  expect(timings.logo).toBe(timings.overlay);

  await expect(splash).toBeHidden({ timeout: 2500 });

  await expect(
    page.getByRole("heading", { name: "Simplifying events" }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate((key) => sessionStorage.getItem(key), SPLASH_STORAGE_KEY),
    )
    .toBe("1");

  await page.reload();
  await expect(page.getByTestId("launch-splash")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Simplifying events" }),
  ).toBeVisible();
});

test("skips the splash when the user prefers reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByTestId("launch-splash")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Simplifying events" }),
  ).toBeVisible();
});
