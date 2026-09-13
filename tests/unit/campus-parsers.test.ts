import { describe, expect, it } from "vitest";
import { parseIcs } from "@/lib/campus/parsers/ics";
import { parseLocalist } from "@/lib/campus/parsers/localist";
import { parseBedework } from "@/lib/campus/parsers/bedework";
import { parseCards } from "@/lib/campus/parsers/cards";
import { parseBabson } from "@/lib/campus/parsers/babson";
import { parseCampusGroups } from "@/lib/campus/parsers/campusgroups";
import { parseRss } from "@/lib/campus/parsers/rss";
import { parseEngage } from "@/lib/campus/parsers/engage";
import { parseClock, parseIcsDate, parseOffsetIso, wallClock } from "@/lib/campus/time";
import { decodeEntities, htmlToText } from "@/lib/campus/text";
import { applySourceRules, selectUpcoming } from "@/lib/campus/sync";
import { collapseSeries, seriesLabel } from "@/lib/campus/series";
import { CAMPUS_SOURCES, sourcesFor } from "@/lib/campus/sources";
import { SCHOOLS } from "@/lib/schools";

const NY = "America/New_York";

describe("campus time", () => {
  it("encodes an instant as the school's wall clock", () => {
    // 13:00Z on Sep 11 is 9:00 AM Eastern (EDT).
    expect(wallClock(new Date("2026-09-11T13:00:00Z"), NY).toISOString()).toBe("2026-09-11T09:00:00.000Z");
    expect(wallClock(new Date("2026-12-11T13:00:00Z"), NY).toISOString()).toBe("2026-12-11T08:00:00.000Z");
  });

  it("reads the three iCalendar date shapes", () => {
    expect(parseIcsDate("20260911", NY)).toEqual({ date: new Date("2026-09-11T00:00:00Z"), allDay: true });
    expect(parseIcsDate("20260911T090000", NY)?.date.toISOString()).toBe("2026-09-11T09:00:00.000Z");
    expect(parseIcsDate("20260911T130000Z", NY)?.date.toISOString()).toBe("2026-09-11T09:00:00.000Z");
    expect(parseIcsDate("nope", NY)).toBeNull();
  });

  it("reads ISO with an offset, or naive local", () => {
    expect(parseOffsetIso("2026-09-11T09:00:00-04:00", NY)?.toISOString()).toBe("2026-09-11T09:00:00.000Z");
    expect(parseOffsetIso("2026-09-19T14:00:00Z", NY)?.toISOString()).toBe("2026-09-19T10:00:00.000Z");
    expect(parseOffsetIso("2026-09-19T14:00:00", NY)?.toISOString()).toBe("2026-09-19T14:00:00.000Z");
  });
});

describe("campus text", () => {
  it("decodes entities and flattens html", () => {
    expect(decodeEntities("Tom &amp; Jerry &#8217;s &#x27;")).toBe("Tom & Jerry ’s '");
    expect(htmlToText("<p>Hello<br>there</p><script>x()</script><p>bye</p>")).toBe("Hello\nthere\nbye");
    expect(htmlToText("&#549313432321551; ok")).toBe("&#549313432321551; ok");
  });
});

describe("ics parser", () => {
  const feed = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:1@x",
    "SUMMARY:Pitch Night\\, Fall",
    "DTSTART;TZID=America/New_York:20260918T190000",
    "DTEND;TZID=America/New_York:20260918T210000",
    "LOCATION:Olin Hall",
    "DESCRIPTION:Bring a deck.\\nDoors 6:45.",
    "URL:https://example.edu/pitch",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:2@x",
    "SUMMARY:All day thing",
    "DTSTART;VALUE=DATE:20260920",
    "X-TRUMBA-LINK:https://example.edu/?eventid=2",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:3@x",
    "SUMMARY:Cancelled",
    "STATUS:CANCELLED",
    "DTSTART:20260920T100000Z",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:4@x",
    "SUMMARY:Folded desc",
    " ription line",
    "DTSTART:20260921T140000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  it("reads events, times, links and folded lines; drops cancelled", () => {
    const events = parseIcs(feed, { timeZone: NY, pageUrl: "https://example.edu/events" });
    expect(events.map((e) => e.title)).toEqual(["Pitch Night, Fall", "All day thing", "Folded description line"]);
    expect(events[0].startsAt.toISOString()).toBe("2026-09-18T19:00:00.000Z");
    expect(events[0].endsAt?.toISOString()).toBe("2026-09-18T21:00:00.000Z");
    expect(events[0].description).toBe("Bring a deck.\nDoors 6:45.");
    expect(events[0].location).toBe("Olin Hall");
    expect(events[0].url).toBe("https://example.edu/pitch");
    expect(events[1].allDay).toBe(true);
    expect(events[1].url).toBe("https://example.edu/?eventid=2");
    expect(events[2].startsAt.toISOString()).toBe("2026-09-21T10:00:00.000Z");
    expect(events[2].url).toBe("https://example.edu/events");
  });

  it("treats Z as local when the feed lies about it", () => {
    const [e] = parseIcs(feed, { timeZone: NY, pageUrl: "x", utcIsLocal: true }).filter((e) => e.externalId === "4@x");
    expect(e.startsAt.toISOString()).toBe("2026-09-21T14:00:00.000Z");
  });
});

describe("localist parser", () => {
  it("makes one row per instance", () => {
    const events = parseLocalist(
      {
        events: [
          {
            event: {
              id: 7,
              title: "Bagel Fridays!",
              localist_url: "https://events.bc.edu/event/bagels",
              photo_url: "https://img/x.png",
              location_name: "Law School",
              room_number: "Stuart 315",
              description_text: "Bagels will be provided.",
              event_instances: [
                { event_instance: { id: 1, start: "2026-09-11T09:00:00-04:00", end: "2026-09-11T10:30:00-04:00", all_day: false } },
                { event_instance: { id: 2, start: "2026-09-18T09:00:00-04:00", end: null, all_day: false } },
              ],
            },
          },
        ],
      },
      { timeZone: NY },
    );
    expect(events).toHaveLength(2);
    expect(events[0].externalId).toBe("7:1");
    expect(events[0].startsAt.toISOString()).toBe("2026-09-11T09:00:00.000Z");
    expect(events[0].endsAt?.toISOString()).toBe("2026-09-11T10:30:00.000Z");
    expect(events[0].location).toBe("Law School · Stuart 315");
    expect(events[1].endsAt).toBeNull();
  });
});

describe("bedework parser", () => {
  it("reads Columbia's feeder shape", () => {
    const events = parseBedework(
      {
        bwEventList: {
          events: [
            {
              guid: "CAL-1",
              recurrenceId: "20260911T130000Z",
              summary: "Office Hours",
              start: { allday: "false", utcdate: "20260911T130000Z" },
              end: { allday: "false", utcdate: "20260911T190000Z" },
              location: { address: "Online Event\t" },
              eventlink: "https://events.columbia.edu/x",
              description: "Sign up.",
            },
          ],
        },
      },
      { timeZone: NY },
    );
    expect(events[0].externalId).toBe("CAL-1:20260911T130000Z");
    expect(events[0].startsAt.toISOString()).toBe("2026-09-11T09:00:00.000Z");
    expect(events[0].location).toBe("Online Event");
  });
});

describe("cards parser", () => {
  const wellesley = `
    <ul>
      <li class="event_list_row"><div><figure><a href="/events/work-shop"><img src="/i/a.jpg"></a></figure>
        <h2 class="t"><a href="https://www.wellesley.edu/events/work-shop">Work/Shop</a></h2>
        <time class="event_list_item_time" datetime="2026-09-11T00:00:00-04:00">Sep 11</time>
        <div class="event_list_item_description"><p>the making of a print studio</p></div>
        <span class="event_list_item_detail">9:00 AM – 5:00 PM</span>
      </li>
      <li class="event_list_row"><h2>No time here</h2></li>
    </ul><footer><time datetime="2026-01-01">footer</time></footer>`;
  const olin = `
      <div class="oln__card oln__card--landing_page_event"><img src="/x.jpg">
        <a href="/events/open-house" class="oln__card-link"><h4 class="oln__card-headline">Open House</h4>
        <p class="oln__card-date"><time datetime="2026-09-19T14:00:00Z">Sep 19</time></p>
        <p class="oln__card-location">Olin College</p><p class="oln__card-copy">Come by.</p></a></div>`;

  it("pulls title, link, time, image and copy out of each item", () => {
    const events = parseCards(wellesley, { timeZone: NY, pageUrl: "https://www.wellesley.edu/events", itemClass: "event_list_row" });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Work/Shop");
    expect(events[0].url).toBe("https://www.wellesley.edu/events/work-shop");
    expect(events[0].startsAt.toISOString()).toBe("2026-09-11T09:00:00.000Z");
    expect(events[0].allDay).toBe(false);
    expect(events[0].description).toBe("the making of a print studio");
    expect(events[0].imageUrl).toBe("https://www.wellesley.edu/i/a.jpg");
  });

  it("converts an instant and finds a location", () => {
    const [e] = parseCards(olin, { timeZone: NY, pageUrl: "https://www.olin.edu/events", itemClass: "oln__card--landing_page_event" });
    expect(e.title).toBe("Open House");
    expect(e.startsAt.toISOString()).toBe("2026-09-19T10:00:00.000Z");
    expect(e.location).toBe("Olin College");
    expect(e.url).toBe("https://www.olin.edu/events/open-house");
  });
});

describe("babson parser", () => {
  const html = `
    <li class="event-item snippet event clearfix"><div class="event-date-box">
      <div class="date-stamp nobackevents"><div class="month">Sep</div><div class="day">18</div><div class="year">2026</div></div>
    </div><div class="event-info-box"><div class="event-info"><header><p class="title">Founders Friday</p></header>
      <p class="categories_trigger"><span class="fa fa-clock"></span> <span class="datelisting">5:30 PM</span> - <span class="datelisting">7:00 PM</span><br/>
      <span class="fa fa-map-marker"></span> Blank Center</p></div></div>
      <div class="event-image-box"><div class="image"> Meet founders. <a class="find-out-more" href="/entrepreneurship/founders-friday/">Find out more</a></div></div></li>
    <li class="event-item"><div class="date-stamp"><div class="month">Oct</div><div class="day">02</div><div class="year">2026</div></div>
      <div class="date-stamp smaller"> – </div>
      <div class="date-stamp2 date-stamp"><div class="month">Oct</div><div class="day">04</div><div class="year">2026</div></div>
      <p class="title">Family Weekend</p></li>`;

  it("reads date boxes, clock times, place and the link", () => {
    const events = parseBabson(html, { pageUrl: "https://www.babson.edu/about/events/" });
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("Founders Friday");
    expect(events[0].startsAt.toISOString()).toBe("2026-09-18T17:30:00.000Z");
    expect(events[0].endsAt?.toISOString()).toBe("2026-09-18T19:00:00.000Z");
    expect(events[0].location).toBe("Blank Center");
    expect(events[0].url).toBe("https://www.babson.edu/entrepreneurship/founders-friday/");
    expect(events[0].description).toBe("Meet founders.");
    expect(events[1].allDay).toBe(true);
    expect(events[1].startsAt.toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(events[1].url).toBe("https://www.babson.edu/about/events/");
  });

  it("parses clocks", () => {
    expect(parseClock("12:00 PM")).toEqual({ h: 12, mi: 0 });
    expect(parseClock("12:15 AM")).toEqual({ h: 0, mi: 15 });
    expect(parseClock("8 pm")).toEqual({ h: 20, mi: 0 });
    expect(parseClock("noon")).toBeNull();
  });
});

describe("selectUpcoming", () => {
  const ev = (id: string, start: string, end: string | null = null) => ({
    externalId: id, title: id, description: null, startsAt: new Date(start), endsAt: end ? new Date(end) : null,
    allDay: false, location: null, url: "u", imageUrl: null,
  });
  it("keeps today onwards within the window, sorted and deduplicated", () => {
    const now = new Date("2026-09-12T15:00:00Z");
    const out = selectUpcoming(
      [ev("late", "2026-09-20T10:00:00Z"), ev("past", "2026-09-01T10:00:00Z"), ev("today", "2026-09-12T09:00:00Z"), ev("today", "2026-09-12T09:00:00Z"), ev("far", "2027-03-01T10:00:00Z")],
      now,
    );
    expect(out.map((e) => e.externalId)).toEqual(["today", "late"]);
  });
});

describe("campusgroups parser", () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><eventId>1</eventId><group>Babson Club Pickleball</group><groupId>g-pickle</groupId><groupType>Student Organization</groupType><title>Pickleball Open Play &amp; More</title>
      <description>Come play.</description><eventStartDateTime>2026-09-14T17:00:00.0000000-04:00</eventStartDateTime>
      <eventEndDateTime>2026-09-14T19:00:00.0000000-04:00</eventEndDateTime><allDayEvent>0</allDayEvent>
      <eventLocation>Private Location (sign in to display)</eventLocation><link>https://belong.babson.edu/BCP/rsvp?id=1</link>
      <eventPhotoFullUrl>https://belong.babson.edu/upload/x.jpg</eventPhotoFullUrl><privacyLevel>0</privacyLevel><approvalStatus>1</approvalStatus></item>
    <item><eventId>2</eventId><title>Members only</title><eventStartDateTime>2026-09-15T17:00:00-04:00</eventStartDateTime><privacyLevel>13</privacyLevel></item>
    <item><eventId>3</eventId><title>Date only</title><eventDate>9/16/2026</eventDate><eventLocation>Reynolds</eventLocation><privacyLevel>0</privacyLevel></item>
  </channel></rss>`;

  it("reads items with times, host and photo; keeps community-only ones, marked", () => {
    const events = parseCampusGroups(xml, { timeZone: NY, pageUrl: "https://belong.babson.edu/events" });
    expect(events.map((e) => e.title)).toEqual(["Pickleball Open Play & More", "Members only", "Date only"]);
    expect(events.map((e) => e.restricted)).toEqual([false, true, false]);
    expect(events[0].startsAt.toISOString()).toBe("2026-09-14T17:00:00.000Z");
    expect(events[0].endsAt?.toISOString()).toBe("2026-09-14T19:00:00.000Z");
    expect(events[0].host).toBe("Babson Club Pickleball");
    expect(events[0].hostId).toBe("g-pickle");
    expect(events[0].hostKind).toBe("Student Organization");
    expect(events[0].location).toBeNull();
    expect(events[0].imageUrl).toBe("https://belong.babson.edu/upload/x.jpg");
    expect(events[0].url).toBe("https://belong.babson.edu/BCP/rsvp?id=1");
    expect(events[2].startsAt.toISOString()).toBe("2026-09-16T00:00:00.000Z");
    expect(events[2].location).toBe("Reynolds");
    expect(events[2].url).toBe("https://belong.babson.edu/events");
  });
});

describe("rss parser", () => {
  it("takes pubDate as the event start", () => {
    const xml = `<rss><channel><item><title>Open Studio &amp; Tea</title><link>https://www.princeton.edu/events/2026/open-studio</link>
      <description>Drop in.</description><pubDate>Fri, 11 Sep 2026 16:30:00 -0400</pubDate><dc:creator>Princeton University</dc:creator><guid>g1</guid></item>
      <item><title>No date</title><link>https://x</link></item></channel></rss>`;
    const events = parseRss(xml, { timeZone: NY, pageUrl: "https://www.princeton.edu/events" });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Open Studio & Tea");
    expect(events[0].startsAt.toISOString()).toBe("2026-09-11T16:30:00.000Z");
    expect(events[0].externalId).toBe("g1");
    expect(events[0].host).toBe("Princeton University");
  });
});

describe("cards parser with a date box", () => {
  const html = `<div class="event-teaser"><div class="event-teaser__date"><div class="event-teaser__date-day"> 12</div><div class="event-teaser__date-month"> Sep</div></div>
    <h2 class="event-teaser__title"><a class="event-teaser__title-link" href="/events/event?event=81792"> Toni Dove: Sunjammer </a></h2>
    <div class="event-teaser__time"> 7:30 pm - 8:30 pm</div><div class="event-teaser__summary"> A cosmic experience.</div></div>
    <div class="event-teaser"><div class="event-teaser__date-day">3</div><div class="event-teaser__date-month">Jan</div>
    <h2><a href="/events/event?event=1">Winter thing</a></h2></div>`;
  it("reads month/day boxes and clock text, inferring the year", () => {
    const events = parseCards(html, {
      timeZone: NY, pageUrl: "https://home.dartmouth.edu/events", itemClass: "event-teaser",
      dateBox: { month: "event-teaser__date-month", day: "event-teaser__date-day", time: "event-teaser__time" },
    });
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("Toni Dove: Sunjammer");
    expect(events[0].startsAt.getUTCMonth()).toBe(8);
    expect(events[0].startsAt.getUTCDate()).toBe(12);
    expect(events[0].startsAt.getUTCHours()).toBe(19);
    expect(events[0].endsAt?.getUTCHours()).toBe(20);
    expect(events[0].allDay).toBe(false);
    expect(events[0].url).toBe("https://home.dartmouth.edu/events/event?event=81792");
    expect(events[1].allDay).toBe(true);
    expect(events[1].startsAt.getUTCFullYear()).toBeGreaterThanOrEqual(new Date().getUTCFullYear());
  });
});

describe("cards parser with dates in text", () => {
  it("reads 'Month D, YYYY, h:mm p.m.' when there's no <time datetime>", () => {
    const html = `<article class="c--event-card"><time> Sep<span>11</span> </time>
      <h3><a href="/event/open-viewing">Open Viewing Nights</a></h3>
      <p>Thursday, September 11, 2026, 8:30 p.m.-Thursday, September 24, 2026, 10:30 p.m.</p></article>`;
    const [e] = parseCards(html, { timeZone: NY, pageUrl: "https://www.rutgers.edu/events", itemClass: "c--event-card" });
    expect(e.title).toBe("Open Viewing Nights");
    expect(e.startsAt.toISOString()).toBe("2026-09-11T20:30:00.000Z");
    expect(e.allDay).toBe(false);
    expect(e.url).toBe("https://www.rutgers.edu/event/open-viewing");
  });
});

describe("engage parser", () => {
  it("reads approved public events with their organisation", () => {
    const events = parseEngage(
      {
        value: [
          { id: 12434441, name: "Brigade Info Night", description: "<p>Come &amp; learn.</p>", startsOn: "2026-09-20T22:00:00+00:00", endsOn: "2026-09-20T23:30:00+00:00", location: "CAS 211", organizationName: "Global Medical Brigades", organizationId: 266686, imagePath: "abc.png", status: "Approved", visibility: "Public" },
          { id: 2, name: "Private thing", startsOn: "2026-09-21T22:00:00+00:00", status: "Approved", visibility: "Private" },
          { id: 3, name: "Pending thing", startsOn: "2026-09-21T22:00:00+00:00", status: "Pending", visibility: "Public" },
        ],
      },
      { timeZone: NY, pageUrl: "https://bu.campuslabs.com/engage/events" },
    );
    expect(events).toHaveLength(1);
    const [e] = events;
    expect(e.title).toBe("Brigade Info Night");
    expect(e.startsAt.toISOString()).toBe("2026-09-20T18:00:00.000Z");
    expect(e.endsAt?.toISOString()).toBe("2026-09-20T19:30:00.000Z");
    expect(e.description).toBe("Come & learn.");
    expect(e.url).toBe("https://bu.campuslabs.com/engage/event/12434441");
    expect(e.imageUrl).toBe("https://se-images.campuslabs.com/clink/images/abc.png?preset=med-w");
    expect(e.host).toBe("Global Medical Brigades");
    expect(e.hostId).toBe("266686");
  });
});

describe("localist organisations", () => {
  it("prefers the student group, then the department, as the host", () => {
    const page = {
      events: [
        { event: { id: 1, title: "Golf", localist_url: "https://x/e1", groups: [{ id: 8214, name: "BC Athletics" }], departments: [{ id: 9, name: "Athletics Dept" }], event_instances: [{ event_instance: { id: 11, start: "2026-09-12T09:00:00-04:00", end: null, all_day: false } }] } },
        { event: { id: 2, title: "Talk", localist_url: "https://x/e2", departments: [{ id: 9, name: "Athletics Dept" }], event_instances: [{ event_instance: { id: 21, start: "2026-09-12T09:00:00-04:00", end: null, all_day: false } }] } },
        { event: { id: 3, title: "Loose", localist_url: "https://x/e3", event_instances: [{ event_instance: { id: 31, start: "2026-09-12T09:00:00-04:00", end: null, all_day: false } }] } },
      ],
    };
    const events = parseLocalist(page, { timeZone: NY });
    expect(events.map((e) => [e.host, e.hostId, e.hostKind])).toEqual([
      ["BC Athletics", "g8214", "Student Organization"],
      ["Athletics Dept", "d9", "Department"],
      [null, null, null],
    ]);
  });
});

describe("sources", () => {
  it("only names known schools, with unique keys", () => {
    const domains = new Set(SCHOOLS.map((s) => s.domain));
    for (const s of CAMPUS_SOURCES) expect(domains.has(s.schoolDomain)).toBe(true);
    expect(new Set(CAMPUS_SOURCES.map((s) => s.key)).size).toBe(CAMPUS_SOURCES.length);
    expect(sourcesFor("babson.edu")).toHaveLength(3);
    expect(sourcesFor("mit.edu").map((s) => s.kind).sort()).toEqual(["campusgroups", "localist"]);
    expect(sourcesFor("nyu.edu").map((s) => s.kind).sort()).toEqual(["engage", "ics"]);
    expect(sourcesFor(null)).toEqual([]);
    // Every top-50 school is in the catalog, feed or not.
    for (const d of ["princeton.edu", "stanford.edu", "caltech.edu", "umich.edu", "purdue.edu", "rochester.edu"]) {
      expect(SCHOOLS.some((s) => s.domain === d)).toBe(true);
    }
    expect(SCHOOLS.length).toBeGreaterThanOrEqual(50);
  });
});

describe("source rules", () => {
  const ev = (title: string, location: string | null) => ({
    externalId: title, title, description: null, startsAt: new Date("2026-09-20T18:00:00Z"), endsAt: null,
    allDay: false, location, url: "u", imageUrl: null,
  });
  it("keeps only matching places and drops a title prefix", () => {
    const source = sourcesFor("babson.edu").find((s) => s.key === "babson.edu/athletics")!;
    const out = applySourceRules(source, [
      ev("Babson College Women's Soccer vs NYU", "Babson Park, Mass., Hartwell-Rogers Field"),
      ev("Babson College Field Hockey at Middlebury", "Middlebury, Vt. / Peter Kohn Field"),
      ev("[L] Babson College Women's Soccer vs #2 Emory", "Babson Park, Mass., Hartwell-Rogers Field"),
      ev("Babson College ", "Babson Park"),
    ]);
    expect(out.map((e) => e.title)).toEqual(["Women's Soccer vs NYU", "Women's Soccer vs #2 Emory", "Babson College "]);
  });
  it("is a no-op for sources without rules", () => {
    const source = sourcesFor("babson.edu").find((s) => s.key === "babson.edu/belong")!;
    expect(applySourceRules(source, [ev("Anything", null)])).toHaveLength(1);
  });
});

describe("series", () => {
  const row = (title: string, host: string | null, start: string) => ({ title, host, startsAt: new Date(start), id: `${title}${start}` });
  it("folds repeats of a title and host into the first date", () => {
    const out = collapseSeries([
      row("Pickleball Open Play", "Babson Club Pickleball", "2026-09-14T17:00:00Z"),
      row("Blank School Welcome Back", "Blank School", "2026-09-16T11:30:00Z"),
      row("Pickleball Open Play", "Babson Club Pickleball", "2026-09-16T17:00:00Z"),
      row("pickleball open play", "Babson Club Pickleball", "2026-09-21T17:00:00Z"),
      row("Pickleball Open Play", "PickleBOS", "2026-09-18T15:00:00Z"),
    ]);
    expect(out.map((e) => [e.title, e.repeats?.count ?? null])).toEqual([
      ["Pickleball Open Play", 3],
      ["Blank School Welcome Back", null],
      ["Pickleball Open Play", null],
    ]);
    expect(out[0].repeats?.label).toBe("Mon & Wed · 5:00 PM · 3 dates");
  });
  it("labels many days and mixed times honestly", () => {
    expect(seriesLabel(["2026-09-14T17:00:00Z", "2026-09-15T17:00:00Z", "2026-09-16T17:00:00Z", "2026-09-17T17:00:00Z"].map((s) => new Date(s))))
      .toBe("Most days · 5:00 PM · 4 dates");
    expect(seriesLabel(["2026-09-14T17:00:00Z", "2026-09-21T19:00:00Z"].map((s) => new Date(s)))).toBe("Mon · 2 dates");
  });
});
