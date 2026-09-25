import { describe, expect, it } from "vitest";
import { migrateAndSeedLogLine, shouldRunMigrateAndSeed } from "@/scripts/vercel-build.mjs";

describe("shouldRunMigrateAndSeed", () => {
  it("runs migrate and seed when VERCEL_ENV is production", () => {
    expect(shouldRunMigrateAndSeed("production")).toBe(true);
    expect(migrateAndSeedLogLine("production")).toBe(
      "Running prisma migrate deploy and db:seed because VERCEL_ENV=production.",
    );
  });

  it("skips migrate and seed for preview, development, and an unset VERCEL_ENV", () => {
    expect(shouldRunMigrateAndSeed("preview")).toBe(false);
    expect(shouldRunMigrateAndSeed("development")).toBe(false);
    expect(shouldRunMigrateAndSeed(undefined)).toBe(false);

    expect(migrateAndSeedLogLine("preview")).toBe(
      "Skipping prisma migrate deploy and db:seed because VERCEL_ENV is preview, not production.",
    );
    expect(migrateAndSeedLogLine("development")).toBe(
      "Skipping prisma migrate deploy and db:seed because VERCEL_ENV is development, not production.",
    );
    expect(migrateAndSeedLogLine(undefined)).toBe(
      "Skipping prisma migrate deploy and db:seed because VERCEL_ENV is unset, not production.",
    );
  });
});
