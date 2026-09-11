import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * The agent image preinstalls Chromium at a build Playwright does not manage,
 * so when that path exists the executable is pointed at explicitly (never run
 * `playwright install` there). Anywhere else — a laptop, CI — Playwright's own
 * browser is used.
 */
const CHROMIUM = "/opt/pw-browsers/chromium";
const launchOptions = existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions,
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
