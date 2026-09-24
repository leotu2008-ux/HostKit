import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Next's dev server re-evaluates modules on every hot reload. Without this
// cache each reload would open a fresh connection pool until Postgres refuses
// new connections. The same cache keeps a warm Vercel isolate from opening
// a new pool on every request.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
    );
  }
  // pg has no connect timeout by default (Prisma 6 had 5s), so a down or full
  // database would hang a page or the cron until Vercel's 300s limit.
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 }),
  });
}

function getClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

// Lazy so `next build` can import this module (and the auth pages that pull
// it in) without a live DATABASE_URL. The error still fires on first query.
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
