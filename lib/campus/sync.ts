import { db } from "@/lib/db";
import { CAMPUS_SOURCES, sourcesFor, type CampusSource } from "@/lib/campus/sources";
import { parseIcs } from "@/lib/campus/parsers/ics";
import { parseLocalist, type LocalistPage } from "@/lib/campus/parsers/localist";
import { parseBedework, type BedeworkFeed } from "@/lib/campus/parsers/bedework";
import { parseCampusGroups } from "@/lib/campus/parsers/campusgroups";
import { parseEngage, type EngagePage } from "@/lib/campus/parsers/engage";
import { parseRss } from "@/lib/campus/parsers/rss";
import { parseCards } from "@/lib/campus/parsers/cards";
import { parseBabson } from "@/lib/campus/parsers/babson";
import type { ParsedEvent } from "@/lib/campus/parsers/types";
import { startOfDay } from "@/lib/plan";
import { suggestHandle } from "@/lib/club-format";

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
/** A feed bigger than this is a broken feed, not a calendar. */
const MAX_FEED_BYTES = 8 * 1024 * 1024;
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
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_FEED_BYTES) throw new Error(`${url} → ${declared} bytes, over the limit`);
  const text = await res.text();
  if (text.length > MAX_FEED_BYTES) throw new Error(`${url} → over the size limit`);
  return text;
}

/** Fetches and parses one source, without touching the database. */
export async function fetchSource(source: CampusSource): Promise<ParsedEvent[]> {
  return applySourceRules(source, await fetchRaw(source));
}

/** The trims a source asks for that no parser knows: keep some places, drop a title prefix. */
export function applySourceRules(source: CampusSource, events: ParsedEvent[]): ParsedEvent[] {
  const place = source.only?.location ? new RegExp(source.only.location, "i") : null;
  const title = source.only?.title ? new RegExp(source.only.title, "i") : null;
  const strip = source.titleStrip ? new RegExp(source.titleStrip) : null;
  return events
    .filter((e) => !place || (e.location !== null && place.test(e.location)))
    .filter((e) => !title || title.test(e.title))
    .map((e) => {
      if (!strip) return e;
      const trimmed = e.title.replace(strip, "").trim();
      return trimmed && trimmed !== e.title ? { ...e, title: trimmed } : e;
    });
}

async function fetchRaw(source: CampusSource): Promise<ParsedEvent[]> {
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
    case "engage": {
      // Upcoming only, soonest first, 100 a page; three pages is plenty.
      const out: ParsedEvent[] = [];
      const since = new Date().toISOString();
      for (let page = 0; page < 3; page++) {
        const params = new URLSearchParams({
          endsAfter: since,
          orderByField: "endsOn",
          orderByDirection: "ascending",
          status: "Approved",
          take: "100",
          skip: String(page * 100),
        });
        const data = JSON.parse(await fetchText(`${source.url}?${params}`)) as EngagePage;
        const found = parseEngage(data, opts);
        out.push(...found);
        if ((data.value?.length ?? 0) < 100) break;
      }
      return out;
    }
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

/** "<sourceKey>:<groupId>" — how a synced club and its events find each other. */
export function hostRefFor(sourceKey: string, hostId: string | null | undefined): string | null {
  return hostId ? `${sourceKey}:${hostId}` : null;
}

/**
 * Keeps a Club row for every real organisation the feed names (Belong at
 * Babson lists the student org or department behind each event). These are
 * the school's actual clubs — created once, renamed if the feed renames
 * them, never invented and never deleted here (people follow them).
 */
export async function syncOfficialClubs(source: CampusSource, events: ParsedEvent[]): Promise<number> {
  const orgs = new Map<string, { name: string; kind: string | null }>();
  for (const e of events) {
    const ref = hostRefFor(source.key, e.hostId);
    if (ref && e.host && !orgs.has(ref)) orgs.set(ref, { name: e.host, kind: e.hostKind ?? null });
  }
  if (orgs.size === 0) return 0;
  const existing = await db.club.findMany({
    where: { sourceRef: { in: [...orgs.keys()] } },
    select: { id: true, sourceRef: true, name: true },
  });
  const byRef = new Map(existing.map((c) => [c.sourceRef!, c]));
  for (const [ref, org] of orgs) {
    const name = org.name.replace(/\s+/g, " ").trim().slice(0, 60);
    const current = byRef.get(ref);
    if (current) {
      if (current.name !== name) await db.club.update({ where: { id: current.id }, data: { name } });
      continue;
    }
    // A handle from the name; on a clash, add a short suffix from the ref.
    const base = suggestHandle(name);
    const suffix = ref.replace(/[^a-z0-9]/gi, "").slice(-4).toLowerCase();
    const handle = (await db.club.findUnique({ where: { handle: base }, select: { id: true } }))
      ? `${base.slice(0, 25)}-${suffix}`
      : base;
    await db.club.create({
      data: {
        handle,
        name,
        sourceRef: ref,
        isOfficial: true,
        schoolDomain: source.schoolDomain,
        // The feed's own word for it ("Student Organization", "Department") goes in the blurb
        // until an admin claims the page and writes a real one.
        blurb: org.kind,
      },
    });
  }
  return orgs.size;
}

export async function syncSource(source: CampusSource): Promise<SyncResult> {
  const now = new Date();
  try {
    const events = selectUpcoming(await fetchSource(source), now);

    // Every run is a full replace, so a feed that answers with nothing would
    // wipe the school. That happens — a calendar blocks the datacentre, or
    // breaks for an afternoon — and an empty campus page is worse than a
    // stale one. Keep what we have and record why.
    if (events.length === 0) {
      const kept = await db.campusEvent.count({ where: { sourceKey: source.key } });
      if (kept > 0) {
        const message = `feed returned no events; kept the ${kept} already stored`;
        await db.campusSync.upsert({
          where: { sourceKey: source.key },
          create: { sourceKey: source.key, schoolDomain: source.schoolDomain, lastRunAt: now, lastError: message },
          update: { lastRunAt: now, lastError: message },
        });
        console.error(`[campus] ${source.key}: ${message}`);
        return { sourceKey: source.key, ok: false, count: kept, error: message };
      }
    }

    await syncOfficialClubs(source, events);
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
          restricted: e.restricted ?? false,
          host: e.host ?? null,
          hostRef: hostRefFor(source.key, e.hostId),
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

/**
 * How many feeds to work on at once. Sources are independent, and most of
 * each one's time is spent waiting on someone else's server, so running them
 * one after another spent the whole budget on a handful of schools — every
 * other campus stayed empty until a student happened to open it.
 */
const CONCURRENCY = 5;

/** Runs `work` over `items`, `limit` at a time, stopping when the budget is spent. */
export async function inPool<T, R>(
  items: T[],
  limit: number,
  expired: () => boolean,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !expired()) {
      results.push(await work(items[next++]));
    }
  });
  await Promise.all(runners);
  return results;
}

export async function syncSchool(schoolDomain: string): Promise<SyncResult[]> {
  return inPool(sourcesFor(schoolDomain), CONCURRENCY, () => false, syncSource);
}

/**
 * The daily sweep: stalest sources first, several at a time, until the time
 * budget is spent so a slow feed can't push the run past the function's
 * limit. Vercel's Hobby plan allows one cron run a day, so this run is the
 * only chance most sources get.
 */
export async function syncAll(budgetMs = 50_000): Promise<SyncResult[]> {
  const started = Date.now();
  const runs = await db.campusSync.findMany({ select: { sourceKey: true, lastOkAt: true } });
  const lastOk = new Map(runs.map((r) => [r.sourceKey, r.lastOkAt?.getTime() ?? 0]));
  const order = [...CAMPUS_SOURCES].sort((a, b) => (lastOk.get(a.key) ?? 0) - (lastOk.get(b.key) ?? 0));
  return inPool(order, CONCURRENCY, () => Date.now() - started > budgetMs, syncSource);
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

/**
 * Fills a school in before its page renders, but only when there is nothing
 * to render — the first person ever to open that campus.
 *
 * Every other refresh happens after the response, which is right: a stale
 * list still beats a slow page. An empty list doesn't. Before this, the
 * first student at a school saw "nothing on" and had to come back once the
 * background sync had finished, which read as a broken app. Bounded, so a
 * campus whose calendar is down costs a wait and not the page.
 */
export async function fillIfEmpty(schoolDomain: string | null | undefined, budgetMs = 7_000): Promise<void> {
  if (!schoolDomain || sourcesFor(schoolDomain).length === 0) return;
  if (inFlight.has(schoolDomain)) return;
  if ((await db.campusEvent.count({ where: { schoolDomain } })) > 0) return;
  inFlight.add(schoolDomain);
  try {
    const started = Date.now();
    await inPool(sourcesFor(schoolDomain), CONCURRENCY, () => Date.now() - started > budgetMs, syncSource);
  } catch (error) {
    console.error(`[campus] first fill for ${schoolDomain} failed`, error);
  } finally {
    inFlight.delete(schoolDomain);
  }
}
