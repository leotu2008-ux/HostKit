import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatInstant, LocalTime } from "@/components/local-time";

// ICU puts a narrow no-break space before AM/PM; compare with plain spaces.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("formatInstant", () => {
  it("formats a check-in time in the reader's zone, not the server's", () => {
    // 23:30 UTC is 7:30 PM in New York (EDT).
    const iso = "2026-09-24T23:30:00.000Z";
    expect(plain(formatInstant(iso, "time", "America/New_York"))).toBe("7:30 PM");
    expect(plain(formatInstant(iso, "time", "UTC"))).toBe("11:30 PM");
  });

  it("dates a blast sent in the evening on the reader's day", () => {
    // 01:00 UTC on the 25th is 9 PM on the 24th in New York.
    const iso = "2026-09-25T01:00:00.000Z";
    expect(formatInstant(iso, "date", "America/New_York")).toBe("Sep 24");
    expect(formatInstant(iso, "date", "UTC")).toBe("Sep 25");
  });
});

describe("<LocalTime>", () => {
  it("renders an empty <time> on the server, so no UTC time is shown", () => {
    const html = renderToStaticMarkup(
      createElement(LocalTime, { iso: "2026-09-24T23:30:00.000Z", format: "time" }),
    );
    expect(html).toBe('<time dateTime="2026-09-24T23:30:00.000Z"></time>');
  });
});
