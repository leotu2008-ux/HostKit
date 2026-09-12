import { describe, expect, it } from "vitest";
import { parseIcs } from "@/lib/campus/parsers/ics";
import { parseLocalist } from "@/lib/campus/parsers/localist";
import { parseBedework } from "@/lib/campus/parsers/bedework";
import { parseCards } from "@/lib/campus/parsers/cards";
import { parseBabson } from "@/lib/campus/parsers/babson";
import { parseCampusGroups } from "@/lib/campus/parsers/campusgroups";
import { parseClock, parseIcsDate, parseOffsetIso, wallClock } from "@/lib/campus/time";
import { decodeEntities, htmlToText } from "@/lib/campus/text";
import { selectUpcoming } from "@/lib/campus/sync";
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
    <item><eventId>1</eventId><group>Babson Club Pickleball</group><title>Pickleball Open Play &amp; More</title>
      <description>Come play.</description><eventStartDateTime>2026-09-14T17:00:00.0000000-04:00</eventStartDateTime>
      <eventEndDateTime>2026-09-14T19:00:00.0000000-04:00</eventEndDateTime><allDayEvent>0</allDayEvent>
      <eventLocation>Private Location (sign in to display)</eventLocation><link>https://belong.babson.edu/BCP/rsvp?id=1</link>
      <eventPhotoFullUrl>https://belong.babson.edu/upload/x.jpg</eventPhotoFullUrl><privacyLevel>0</privacyLevel><approvalStatus>1</approvalStatus></item>
    <item><eventId>2</eventId><title>Members only</title><eventStartDateTime>2026-09-15T17:00:00-04:00</eventStartDateTime><privacyLevel>13</privacyLevel></item>
    <item><eventId>3</eventId><title>Date only</title><eventDate>9/16/2026</eventDate><eventLocation>Reynolds</eventLocation><privacyLevel>0</privacyLevel></item>
  </channel></rss>`;

  it("reads public items with times, host and photo; skips private ones", () => {
    const events = parseCampusGroups(xml, { timeZone: NY, pageUrl: "https://belong.babson.edu/events" });
    expect(events.map((e) => e.title)).toEqual(["Pickleball Open Play & More", "Date only"]);
    expect(events[0].startsAt.toISOString()).toBe("2026-09-14T17:00:00.000Z");
    expect(events[0].endsAt?.toISOString()).toBe("2026-09-14T19:00:00.000Z");
    expect(events[0].host).toBe("Babson Club Pickleball");
    expect(events[0].location).toBeNull();
    expect(events[0].imageUrl).toBe("https://belong.babson.edu/upload/x.jpg");
    expect(events[0].url).toBe("https://belong.babson.edu/BCP/rsvp?id=1");
    expect(events[1].startsAt.toISOString()).toBe("2026-09-16T00:00:00.000Z");
    expect(events[1].location).toBe("Reynolds");
    expect(events[1].url).toBe("https://belong.babson.edu/events");
  });
});

describe("sources", () => {
  it("only names known schools, with unique keys", () => {
    const domains = new Set(SCHOOLS.map((s) => s.domain));
    for (const s of CAMPUS_SOURCES) expect(domains.has(s.schoolDomain)).toBe(true);
    expect(new Set(CAMPUS_SOURCES.map((s) => s.key)).size).toBe(CAMPUS_SOURCES.length);
    expect(sourcesFor("babson.edu")).toHaveLength(2);
    expect(sourcesFor(null)).toEqual([]);
  });
});
