import { describe, expect, it } from "vitest";
import { isViable, priceForEvent, scoreListing } from "@/lib/scoring";
import type { ScorableEvent, ScorableListing } from "@/lib/scoring";

const venue = (over: Partial<ScorableListing> = {}): ScorableListing => ({
  priceCents: 70_000, // $700/hr
  priceUnit: "HOUR",
  capacityMin: 40,
  capacityMax: 120,
  leadTimeDays: 30,
  rating: 4.2,
  reviewCount: 40,
  ...over,
});

const event = (over: Partial<ScorableEvent> = {}): ScorableEvent => ({
  guestCount: 90,
  durationHours: 6,
  daysUntil: 120,
  ...over,
});

describe("priceForEvent", () => {
  it("multiplies an hourly rate by the event's duration", () => {
    const { cents, basis } = priceForEvent(venue(), event());
    expect(cents).toBe(420_000);
    expect(basis).toBe("6 hours");
  });

  it("keeps an hourly estimate in whole cents over a part-hour night", () => {
    // Money is integer cents: $33.33/hr for 90 minutes is 4999.5¢, not a price.
    const listing = venue({ priceCents: 3_333 });
    expect(priceForEvent(listing, event({ durationHours: 1.5 })).cents).toBe(
      5_000,
    );
    expect(priceForEvent(listing, event({ durationHours: 0.25 })).cents).toBe(
      833,
    );
  });

  it("multiplies a per-person rate by the headcount", () => {
    const { cents, basis } = priceForEvent(
      venue({ priceCents: 8_500, priceUnit: "PERSON" }),
      event(),
    );
    expect(cents).toBe(765_000);
    expect(basis).toBe("90 guests");
  });

  it("leaves a day rate and a flat fee alone", () => {
    expect(
      priceForEvent(venue({ priceCents: 350_000, priceUnit: "DAY" }), event())
        .cents,
    ).toBe(350_000);
    expect(
      priceForEvent(venue({ priceCents: 120_000, priceUnit: "FLAT" }), event())
        .cents,
    ).toBe(120_000);
  });

  it("reprices when the event changes, not when the listing does", () => {
    // The whole point: one listing, two events, two different real costs.
    const listing = venue();
    expect(priceForEvent(listing, event({ durationHours: 4 })).cents).toBe(
      280_000,
    );
    expect(priceForEvent(listing, event({ durationHours: 10 })).cents).toBe(
      700_000,
    );
  });
});

describe("scoreListing — capacity", () => {
  it("fits comfortably when well inside capacity", () => {
    const fit = scoreListing(venue(), event({ guestCount: 60 }), 1_000_000);
    expect(fit.capacity).toBe("fits");
  });

  it("is tight within a tenth of the maximum", () => {
    const fit = scoreListing(venue({ capacityMax: 95 }), event(), 1_000_000);
    expect(fit.capacity).toBe("tight");
    expect(fit.capacityNote).toContain("only just");
  });

  it("counts exactly at capacity as tight, not a failure", () => {
    const fit = scoreListing(venue({ capacityMax: 90 }), event(), 1_000_000);
    expect(fit.capacity).toBe("tight");
  });

  it("is too small one guest over the maximum", () => {
    const fit = scoreListing(venue({ capacityMax: 89 }), event(), 1_000_000);
    expect(fit.capacity).toBe("too_small");
    expect(fit.capacityNote).toBe("Holds 89 — you have 90");
  });

  it("is too big below the venue's minimum", () => {
    const fit = scoreListing(
      venue({ capacityMin: 150, capacityMax: 400 }),
      event(),
      1_000_000,
    );
    expect(fit.capacity).toBe("too_big");
  });

  it("has no capacity opinion about a vendor", () => {
    const fit = scoreListing(
      venue({ capacityMin: null, capacityMax: null }),
      event(),
      1_000_000,
    );
    expect(fit.capacity).toBe("unknown");
    expect(fit.capacityNote).toBeNull();
  });
});

describe("scoreListing — budget", () => {
  it("reports the share of the category allocation", () => {
    // $4,200 of a $15,000 venue allocation.
    const fit = scoreListing(venue(), event(), 1_500_000);
    expect(fit.estimatedCents).toBe(420_000);
    expect(fit.budgetSharePercent).toBe(28);
    expect(fit.budget).toBe("comfortable");
  });

  it("calls it a stretch just past the allocation", () => {
    const fit = scoreListing(venue(), event(), 400_000);
    expect(fit.budget).toBe("stretch");
  });

  it("calls it over well past the allocation", () => {
    const fit = scoreListing(venue(), event(), 200_000);
    expect(fit.budget).toBe("over");
    expect(fit.budgetSharePercent).toBe(210);
  });

  it("says nothing about budget when the category is unallocated", () => {
    // An unallocated category should read as "no budget set", not as free.
    const fit = scoreListing(venue(), event(), 0);
    expect(fit.budget).toBe("unknown");
    expect(fit.budgetSharePercent).toBeNull();
  });

  it("says nothing about budget when no allocation is passed at all", () => {
    const fit = scoreListing(venue(), event(), null);
    expect(fit.budgetSharePercent).toBeNull();
  });
});

describe("scoreListing — lead time", () => {
  it("is fine with plenty of notice", () => {
    expect(scoreListing(venue(), event({ daysUntil: 120 }), 1_500_000).lead)
      .toBe("ok");
  });

  it("is tight just above the minimum notice", () => {
    const fit = scoreListing(
      venue({ leadTimeDays: 30 }),
      event({ daysUntil: 40 }),
      1_500_000,
    );
    expect(fit.lead).toBe("tight");
  });

  it("is too late below the minimum notice", () => {
    const fit = scoreListing(
      venue({ leadTimeDays: 30 }),
      event({ daysUntil: 12 }),
      1_500_000,
    );
    expect(fit.lead).toBe("too_late");
    expect(fit.leadNote).toBe("Wants 30 days' notice — you have 12");
  });

  it("does not report negative days remaining for a past event", () => {
    const fit = scoreListing(
      venue({ leadTimeDays: 30 }),
      event({ daysUntil: -5 }),
      1_500_000,
    );
    expect(fit.leadNote).toBe("Wants 30 days' notice — you have 0");
  });

  it("has no lead-time opinion when the date is unset", () => {
    const fit = scoreListing(venue(), event({ daysUntil: null }), 1_500_000);
    expect(fit.lead).toBe("unknown");
  });
});

describe("scoreListing — score", () => {
  it("gives a well-matched, well-reviewed listing a top score", () => {
    const fit = scoreListing(
      venue({ rating: 4.9, reviewCount: 120 }),
      event({ guestCount: 60 }),
      1_500_000,
    );
    expect(fit.score).toBeGreaterThanOrEqual(95);
  });

  it("ranks a too-small venue below a merely expensive one", () => {
    const tooSmall = scoreListing(venue({ capacityMax: 50 }), event(), 1_500_000);
    const expensive = scoreListing(venue(), event(), 300_000);
    expect(tooSmall.score).toBeLessThan(expensive.score);
  });

  it("never lets reputation rescue a listing that doesn't fit", () => {
    const beloved = scoreListing(
      venue({ capacityMax: 40, rating: 5, reviewCount: 500 }),
      event(),
      1_500_000,
    );
    const plain = scoreListing(
      venue({ rating: 3.9, reviewCount: 8 }),
      event({ guestCount: 60 }),
      1_500_000,
    );
    expect(beloved.score).toBeLessThan(plain.score);
  });

  it("ignores a rating backed by too few reviews", () => {
    const withFew = scoreListing(
      venue({ rating: 5, reviewCount: 2 }),
      event({ guestCount: 60 }),
      1_500_000,
    );
    const withNone = scoreListing(
      venue({ rating: null, reviewCount: 0 }),
      event({ guestCount: 60 }),
      1_500_000,
    );
    expect(withFew.score).toBe(withNone.score);
  });

  it("stays inside 0-100 even when everything is wrong at once", () => {
    const fit = scoreListing(
      venue({ capacityMax: 10, leadTimeDays: 200, rating: 1, reviewCount: 90 }),
      event({ daysUntil: 3 }),
      100,
    );
    expect(fit.score).toBeGreaterThanOrEqual(0);
    expect(fit.score).toBeLessThanOrEqual(100);
  });
});

describe("isViable", () => {
  it("disqualifies a venue that cannot hold the guests", () => {
    expect(isViable(scoreListing(venue({ capacityMax: 20 }), event(), 1_500_000)))
      .toBe(false);
  });

  it("disqualifies a listing that cannot be booked in time", () => {
    expect(
      isViable(
        scoreListing(venue({ leadTimeDays: 90 }), event({ daysUntil: 10 }), 1_500_000),
      ),
    ).toBe(false);
  });

  it("keeps a listing that is merely expensive", () => {
    // Over budget is the host's call to make, not a disqualification.
    expect(isViable(scoreListing(venue(), event(), 100_000))).toBe(true);
  });
});
