import { describe, expect, it } from "vitest";
import { eventSearch, searchTerm } from "@/lib/search";
import { whenLabel } from "@/components/event-card";

describe("search", () => {
  it("trims and caps the term, and matches nothing special when empty", () => {
    expect(searchTerm("  pitch night ")).toBe("pitch night");
    expect(searchTerm(["a", "b"])).toBe("a");
    expect(searchTerm("x".repeat(100)).length).toBe(80);
    expect(eventSearch("")).toEqual({});
    expect(eventSearch("  ")).toEqual({});
  });

  it("builds a case-insensitive OR over title, description, place, host and club", () => {
    const where = eventSearch("Pitch") as { OR: unknown[] };
    expect(where.OR).toHaveLength(5);
    expect(where.OR[0]).toEqual({ title: { contains: "Pitch", mode: "insensitive" } });
  });
});

describe("whenLabel", () => {
  const base = { id: "x", title: "t", city: "Boston, MA", durationHours: 2 };
  it("says All day, and shows no fake duration for official events", () => {
    const day = new Date(Date.UTC(2026, 8, 18, 0, 0));
    expect(whenLabel({ ...base, date: day, official: true, allDay: true })).toMatch(/All day$/);
    const start = new Date(2026, 8, 18, 19, 30);
    expect(whenLabel({ ...base, date: start, official: true, endsAt: null })).toMatch(/7:30 PM$/);
    const end = new Date(2026, 8, 18, 21, 0);
    expect(whenLabel({ ...base, date: start, official: true, endsAt: end })).toMatch(/7:30 PM – 9:00 PM$/);
    expect(whenLabel({ ...base, date: start })).toMatch(/7:30 PM · 2h$/);
  });
});
