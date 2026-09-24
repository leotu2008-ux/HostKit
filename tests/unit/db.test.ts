import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  PrismaPg: vi.fn(),
  PrismaClient: vi.fn(function (this: Record<string, unknown>) {
    this.event = { findMany: vi.fn() };
  }),
}));

vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: mocks.PrismaPg }));
vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: mocks.PrismaClient,
}));

describe("db", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { prisma?: unknown }).prisma;
  });

  it("gives up connecting after 5 seconds instead of waiting out the function limit", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/hosty_test");
    const { db } = await import("@/lib/db");

    void db.event;

    expect(mocks.PrismaPg).toHaveBeenCalledWith({
      connectionString: "postgresql://localhost:5432/hosty_test",
      connectionTimeoutMillis: 5_000,
    });
  });
});
