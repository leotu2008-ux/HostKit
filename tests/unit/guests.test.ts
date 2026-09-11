import { describe, expect, it } from "vitest";
import {
  effectiveHeadcount,
  parseGuestList,
  summarizeGuests,
} from "@/lib/guests";
import type { GuestLike } from "@/lib/guests";

const g = (rsvpStatus: GuestLike["rsvpStatus"], plusOnes = 0): GuestLike => ({
  rsvpStatus,
  plusOnes,
});

describe("summarizeGuests", () => {
  it("counts plus-ones as heads", () => {
    const s = summarizeGuests([g("ATTENDING", 1), g("ATTENDING", 0)]);
    expect(s.attending).toBe(2);
    expect(s.confirmedHeads).toBe(3);
  });

  it("excludes declines from the expected count", () => {
    const s = summarizeGuests([
      g("ATTENDING", 1),
      g("DECLINED", 1),
      g("INVITED"),
      g("MAYBE"),
    ]);
    expect(s.confirmedHeads).toBe(2);
    expect(s.expectedHeads).toBe(4);
  });

  it("computes a response rate", () => {
    const s = summarizeGuests([g("ATTENDING"), g("DECLINED"), g("INVITED")]);
    expect(s.responded).toBe(2);
    expect(s.responseRate).toBe(67);
  });

  it("handles an empty list without dividing by zero", () => {
    const s = summarizeGuests([]);
    expect(s.responseRate).toBe(0);
    expect(s.expectedHeads).toBe(0);
  });

  it("ignores a negative plus-one count", () => {
    expect(summarizeGuests([g("ATTENDING", -3)]).confirmedHeads).toBe(1);
  });
});

describe("effectiveHeadcount", () => {
  it("uses the planned figure until there is a guest list", () => {
    const result = effectiveHeadcount(90, summarizeGuests([]));
    expect(result).toEqual({ count: 90, source: "planned" });
  });

  it("does NOT collapse to the confirmed count early in an RSVP round", () => {
    // Two replies out of ninety invitations must not reprice for two guests.
    const guests = [
      g("ATTENDING"),
      g("ATTENDING"),
      ...Array.from({ length: 88 }, () => g("INVITED")),
    ];
    expect(effectiveHeadcount(90, summarizeGuests(guests)).count).toBe(90);
  });

  it("does NOT collapse while the guest list is still being entered", () => {
    // Four names typed of a planned forty is an incomplete list, not a
    // party of four. This is the case that matters most in practice.
    const guests = Array.from({ length: 4 }, () => g("INVITED"));
    const result = effectiveHeadcount(40, summarizeGuests(guests));
    expect(result.count).toBe(40);
    expect(result.source).toBe("planned");
  });

  it("falls as regrets come in", () => {
    const guests = [
      ...Array.from({ length: 80 }, () => g("ATTENDING")),
      ...Array.from({ length: 10 }, () => g("DECLINED")),
    ];
    const result = effectiveHeadcount(90, summarizeGuests(guests));
    expect(result.count).toBe(80);
    expect(result.source).toBe("rsvp");
  });

  it("subtracts a decline from the planned figure even on a partial list", () => {
    const guests = [g("DECLINED"), g("INVITED"), g("ATTENDING")];
    expect(effectiveHeadcount(40, summarizeGuests(guests)).count).toBe(39);
  });

  it("counts a decliner's plus-ones as also not coming", () => {
    expect(effectiveHeadcount(40, summarizeGuests([g("DECLINED", 1)])).count)
      .toBe(38);
  });

  it("follows the guest list up when it outgrows the estimate", () => {
    const guests = Array.from({ length: 50 }, () => g("INVITED"));
    const result = effectiveHeadcount(40, summarizeGuests(guests));
    expect(result.count).toBe(50);
    expect(result.source).toBe("rsvp");
  });

  it("never goes negative when everyone declines", () => {
    const guests = Array.from({ length: 60 }, () => g("DECLINED"));
    expect(effectiveHeadcount(40, summarizeGuests(guests)).count).toBe(0);
  });
});

describe("parseGuestList", () => {
  it("parses 'Name <email>'", () => {
    expect(parseGuestList("Ada Lovelace <ada@example.com>")).toEqual([
      { name: "Ada Lovelace", email: "ada@example.com" },
    ]);
  });

  it("parses 'Name, email'", () => {
    expect(parseGuestList("Ada Lovelace, ada@example.com")).toEqual([
      { name: "Ada Lovelace", email: "ada@example.com" },
    ]);
  });

  it("parses a bare name", () => {
    expect(parseGuestList("Ada Lovelace")).toEqual([
      { name: "Ada Lovelace", email: null },
    ]);
  });

  it("parses a bare email, using it as the name", () => {
    expect(parseGuestList("ada@example.com")).toEqual([
      { name: "ada@example.com", email: "ada@example.com" },
    ]);
  });

  it("handles a multi-line paste with mixed formats", () => {
    const parsed = parseGuestList(
      `Ada Lovelace <ada@example.com>
       Grace Hopper, grace@example.com

       Alan Turing`,
    );
    expect(parsed).toHaveLength(3);
    expect(parsed[2]).toEqual({ name: "Alan Turing", email: null });
  });

  it("ignores blank lines and stray whitespace", () => {
    expect(parseGuestList("\n\n   \n")).toEqual([]);
  });
});
