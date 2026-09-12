import { db } from "@/lib/db";
import { CAMPUS_SOURCES, sourcesFor, type CampusSource } from "@/lib/campus/sources";
import { parseIcs } from "@/lib/campus/parsers/ics";
import { parseLocalist, type LocalistPage } from "@/lib/campus/parsers/localist";
import { parseBedework, type BedeworkFeed } from "@/lib/campus/parsers/bedework";
import { parseCampusGroups } from "@/lib/campus/parsers/campusgroups";
import { parseRss } from "@/lib/campus/parsers/rss";
import { parseCards } from "@/lib/campus/parsers/cards";
import { parseBabson } from "@/lib/campus/parsers/babson";
import type { ParsedEvent } from "@/lib/campus/parsers/types";
import { startOfDay } from "@/lib/plan";

/**
 * Pulls each school's official calendar into CampusEvent. Runs from the cron
 * route daily and, for one school at a time, whenever a student opens a feed
 * whose sync is older than STALE_AFTER_MS (see refreshIfStale).
 *
 * Every run is a full replace for its source: what the feed lists now is
 * what we show, so cancelled or moved events disappear on the next pass.
 */

export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
/** How far ahead to keep. Feeds that dump a whole year are trimmed to this. */
const WINDOW_DAYS = 90;
/** Most events kept per source; the soonest win. */
const MAX_PER_SOURCE = 400;
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "Mozilla/5.0 (compatible; HostKit/1.0; +https://host-kit-one.vercel.app)";

export type SyncResult = { sourceKey: string; ok: boolean; count: number; error?: string };

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/calendar, application/json, text/html;q=0.9, */*;q=0.8" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

/** Fetches and parses one source, without touching the database. */
export async function fetchSource(source: CampusSource): Promise<ParsedEvent[]> {
  const opts = { timeZone: source.timeZone, pageUrl: source.homepage };
  switch (source.kind) {
    case "localist": {
      const out: ParsedEvent[] = [];
      // Localist pages at 100; three pages cover a busy campus's next 60 days.
      for (let page = 1; page <= 3; page++) {
        const sep = source.url.includes("?") ? "&" : "?";
        const text = await fetchText(`${source.url}${sep}days=60&pp=100&page=${page}`);
        const data = JSON.parse(text) as LocalistPage;
        out.push(...parseLocalist(data, opts));
        if (!data.page?.next_page) break;
      }
      return out;
    }
    case "ics":
      return parseIcs(await fetchText(source.url), { ...opts, utcIsLocal: source.icsUtcIsLocal });
    case "bedework": {
      const text = await fetchText(source.url);
      return parseBedework(JSON.parse(text) as BedeworkFeed, opts);
    }
    case "campusgroups":
      return parseCampusGroups(await fetchText(source.url), opts);
    case "rss":
      return parseRss(await fetchText(source.url), opts);
    case "cards": {
      const out: ParsedEvent[] = [];
      const pages = source.pages ?? 1;
      for (let page = 1; page <= pages; page++) {
        const sep = source.url.includes("?") ? "&" : "?";
        const url = page === 1 ? source.url : `${source.url}${sep}page=${page}`;
        const found = parseCards(await fetchText(url), {
          ...opts,
          itemClass: source.itemClass ?? "event",
          dateBox: source.dateBox,
        });
        if (found.length === 0) break;
        out.push(...found);
      }
      return out;
    }
    case "babson":
      return parseBabson(await fetchText(source.url), opts);
  }
}

/**
 * Upcoming, deduplicated, soonest first, capped. "Upcoming" means starting
 * today or later: a semester-long exhibition that opened last month is the
 * school's news, not what's on this week.
 */
export function selectUpcoming(events: ParsedEvent[], now = new Date()): ParsedEvent[] {
  // Wall-clock dates compare against a wall-clock "today" (encoded as UTC).
  const local = startOfDay(now);
  const from = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  const to = new Date(from.getTime() + WINDOW_DAYS * 86_400_000);
  const seen = new Set<string>();
  return events
    .filter((e) => e.startsAt >= from && e.startsAt <= to)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .filter((e) => {
      if (seen.has(e.externalId)) return false;
      seen.add(e.externalId);
      return true;
    })
    .slice(0, MAX_PER_SOURCE);
}

export async function syncSource(source: CampusSource): Promise<SyncResult> {
  const now = new Date();
  try {
    const events = selectUpcoming(await fetchSource(source), now);
    await db.$transaction(async (tx) => {
      await tx.campusEvent.deleteMany({
        where: { sourceKey: source.key, externalId: { notIn: events.map((e) => e.externalId) } },
      });
      for (const e of events) {
        const data = {
          schoolDomain: source.schoolDomain,
          title: e.title,
          description: e.description,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          allDay: e.allDay,
          location: e.location,
          host: e.host ?? null,
          url: e.url,
          imageUrl: e.imageUrl,
        };
        await tx.campusEvent.upsert({
          where: { sourceKey_externalId: { sourceKey: source.key, externalId: e.externalId } },
          create: { sourceKey: source.key, externalId: e.externalId, ...data },
          update: data,
        });
      }
      await tx.campusSync.upsert({
        where: { sourceKey: source.key },
        create: { sourceKey: source.key, schoolDomain: source.schoolDomain, lastRunAt: now, lastOkAt: now, lastError: null, eventCount: events.length },
        update: { lastRunAt: now, lastOkAt: now, lastError: null, eventCount: events.length },
      });
    }, { timeout: 60_000 });
    return { sourceKey: source.key, ok: true, count: events.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.campusSync.upsert({
      where: { sourceKey: source.key },
      create: { sourceKey: source.key, schoolDomain: source.schoolDomain, lastRunAt: now, lastError: message },
      update: { lastRunAt: now, lastError: message },
    });
    console.error(`[campus] ${source.key}: ${message}`);
    return { sourceKey: source.key, ok: false, count: 0, error: message };
  }
}

export async function syncSchool(schoolDomain: string): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const source of sourcesFor(schoolDomain)) results.push(await syncSource(source));
  return results;
}

/**
 * The daily sweep: stalest sources first, until the time budget is spent so
 * a slow feed can't push the run past the function's limit.
 */
export async function syncAll(budgetMs = 50_000): Promise<SyncResult[]> {
  const started = Date.now();
  const runs = await db.campusSync.findMany({ select: { sourceKey: true, lastOkAt: true } });
  const lastOk = new Map(runs.map((r) => [r.sourceKey, r.lastOkAt?.getTime() ?? 0]));
  const order = [...CAMPUS_SOURCES].sort((a, b) => (lastOk.get(a.key) ?? 0) - (lastOk.get(b.key) ?? 0));
  const results: SyncResult[] = [];
  for (const source of order) {
    if (Date.now() - started > budgetMs) break;
    results.push(await syncSource(source));
  }
  return results;
}

/** When the school's feeds last succeeded (the oldest of them), or null. */
export async function lastSyncedAt(schoolDomain: string): Promise<Date | null> {
  const sources = sourcesFor(schoolDomain);
  if (sources.length === 0) return null;
  const runs = await db.campusSync.findMany({
    where: { sourceKey: { in: sources.map((s) => s.key) } },
    select: { lastOkAt: true },
  });
  if (runs.length < sources.length) return null;
  const times = runs.map((r) => r.lastOkAt?.getTime() ?? 0);
  return times.some((t) => t === 0) ? null : new Date(Math.min(...times));
}

/** True when a school's feeds have never run, or ran more than STALE_AFTER_MS ago. */
export async function isStale(schoolDomain: string): Promise<boolean> {
  if (sourcesFor(schoolDomain).length === 0) return false;
  const at = await lastSyncedAt(schoolDomain);
  return !at || Date.now() - at.getTime() > STALE_AFTER_MS;
}

const inFlight = new Set<string>();

/**
 * Refreshes a school in the background when its feeds are stale. Callers
 * wrap this in Next's `after()` so the page or API response isn't held up.
 * One refresh per school at a time per server instance.
 */
export async function refreshIfStale(schoolDomain: string | null | undefined): Promise<void> {
  if (!schoolDomain || inFlight.has(schoolDomain)) return;
  if (!(await isStale(schoolDomain))) return;
  inFlight.add(schoolDomain);
  try {
    await syncSchool(schoolDomain);
  } finally {
    inFlight.delete(schoolDomain);
  }
}
