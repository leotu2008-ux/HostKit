/**
 * One-off import of CampusEvent rows from a JSON dump (Babson Belong club
 * events). Upserts on @@unique([sourceKey, externalId]); re-runs are
 * idempotent and never delete rows the file does not mention.
 *
 *   DATABASE_URL=... npx tsx scripts/import-campus-json.ts path/to.json
 */

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import {
  parseCampusJson,
  sameMappedEvent,
  type MappedCampusEvent,
} from "../lib/campus/json-import";

function usage(): never {
  console.error("Usage: npx tsx scripts/import-campus-json.ts <path-to.json>");
  process.exit(1);
}

function requireDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Refusing to run: DATABASE_URL is not set.");
    process.exit(1);
  }
  return connectionString;
}

export async function importCampusJson(
  db: PrismaClient,
  payload: unknown,
): Promise<{ inserted: number; updated: number; unchanged: number; skipped: number; skippedReasons: string[] }> {
  const { rows, skipped } = parseCampusJson(payload);
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, unchanged: 0, skipped: skipped.length, skippedReasons: skipped };
  }

  const bySource = new Map<string, MappedCampusEvent[]>();
  for (const row of rows) {
    const list = bySource.get(row.sourceKey) ?? [];
    list.push(row);
    bySource.set(row.sourceKey, list);
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const [sourceKey, sourceRows] of bySource) {
    const existing = await db.campusEvent.findMany({
      where: {
        sourceKey,
        externalId: { in: sourceRows.map((row) => row.externalId) },
      },
      select: {
        id: true,
        externalId: true,
        schoolDomain: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        location: true,
        restricted: true,
        host: true,
        url: true,
      },
    });
    const before = new Map(existing.map((row) => [row.externalId, row]));
    const fresh = sourceRows.filter((row) => !before.has(row.externalId));
    if (fresh.length > 0) {
      await db.campusEvent.createMany({ data: fresh, skipDuplicates: true });
      inserted += fresh.length;
    }

    for (const row of sourceRows) {
      const was = before.get(row.externalId);
      if (!was) continue;
      if (sameMappedEvent(was, row)) {
        unchanged += 1;
        continue;
      }
      await db.campusEvent.update({
        where: { id: was.id },
        data: {
          schoolDomain: row.schoolDomain,
          title: row.title,
          description: row.description,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          allDay: row.allDay,
          location: row.location,
          restricted: row.restricted,
          host: row.host,
          url: row.url,
        },
      });
      updated += 1;
    }
  }

  return { inserted, updated, unchanged, skipped: skipped.length, skippedReasons: skipped };
}

async function main(): Promise<void> {
  const jsonPath = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  if (!jsonPath) usage();

  const connectionString = requireDatabaseUrl();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const absolute = resolve(jsonPath);
    const payload = JSON.parse(await readFile(absolute, "utf8")) as unknown;
    const result = await importCampusJson(db, payload);
    console.log(
      `Campus JSON import ${absolute}: inserted ${result.inserted}, updated ${result.updated}, unchanged ${result.unchanged}, skipped ${result.skipped}`,
    );
    for (const reason of result.skippedReasons) console.error(`skip ${reason}`);
  } finally {
    await db.$disconnect();
  }
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

function redact(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://***")
    .replace(/DATABASE_URL=\S+/g, "DATABASE_URL=***");
}

if (invokedDirectly()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(message));
    process.exit(1);
  });
}
