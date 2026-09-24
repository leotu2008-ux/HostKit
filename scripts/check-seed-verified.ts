/**
 * Fails if a seeded demo account cannot sign in.
 *
 * Sign-in refuses an address that has never been confirmed (lib/auth.ts), and
 * a seeded account has no inbox to confirm from. A one-time migration
 * (20260912120000_verified_existing) back-filled everyone who existed on
 * 2026-09-12, which is exactly why this stayed invisible: on a development
 * database the demo accounts were already there, so they were back-filled and
 * kept working. On any database seeded *after* that migration — a fresh
 * production deploy, or CI — the same accounts were created unconfirmed and
 * could never sign in.
 *
 * Run after `prisma migrate deploy && npm run db:seed`.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const EXPECTED = ["maya@hosty.demo", "sam@babson.edu"];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  let failed = false;
  try {
    for (const email of EXPECTED) {
      const user = await db.user.findUnique({
        where: { email },
        select: { email: true, emailVerifiedAt: true },
      });
      if (!user) {
        console.error(`FAIL ${email} was not seeded at all`);
        failed = true;
      } else if (!user.emailVerifiedAt) {
        console.error(`FAIL ${email} has no emailVerifiedAt, so sign-in will reject it`);
        failed = true;
      } else {
        console.log(`ok   ${email} is confirmed and can sign in`);
      }
    }
  } finally {
    await db.$disconnect();
  }

  if (failed) {
    console.error("\nSeeded accounts must be created already confirmed. See prisma/seed.ts.");
    process.exit(1);
  }
}

main();
