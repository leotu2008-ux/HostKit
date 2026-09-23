/**
 * Run once, by hand, right after the production deploy of the recurring-hosts
 * migration. Its backfill only saw guests that existed when the preview
 * environment ran it; anyone added to an event between that preview migration
 * and this merge landing never got linked to a Contact. This re-runs the same
 * two idempotent statements so they catch up.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  try {
    // Backfill the guest book: one Contact per host and lowercased email, from existing guests.
    const inserted = await db.$executeRawUnsafe(`
      INSERT INTO "Contact" ("id", "ownerId", "name", "email", "createdAt")
      SELECT gen_random_uuid()::text, e."ownerId", MAX(g."name"), lower(trim(g."email")), MIN(g."createdAt")
      FROM "Guest" g
      JOIN "Event" e ON e."id" = g."eventId"
      WHERE g."email" IS NOT NULL AND trim(g."email") <> '' AND e."ownerId" IS NOT NULL
      GROUP BY e."ownerId", lower(trim(g."email"))
      ON CONFLICT ("ownerId", "email") DO NOTHING;
    `);
    console.log(`Contact rows inserted: ${inserted}`);

    const linked = await db.$executeRawUnsafe(`
      UPDATE "Guest" g
      SET "contactId" = c."id"
      FROM "Event" e, "Contact" c
      WHERE e."id" = g."eventId"
        AND c."ownerId" = e."ownerId"
        AND c."email" = lower(trim(g."email"))
        AND g."contactId" IS NULL;
    `);
    console.log(`Guest rows linked: ${linked}`);
  } finally {
    await db.$disconnect();
  }
}

main();
