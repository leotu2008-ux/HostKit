import { describe, expect, it } from "vitest";
import {
  daysBetween,
  describeCountdown,
  generatePlan,
  startOfDay,
} from "@/lib/plan";
import { EVENT_TEMPLATES } from "@/lib/templates";
import { ALL_EVENT_TYPES } from "@/lib/catalog";

const NOW = new Date("2026-01-15T09:30:00");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("event templates", () => {
  it("covers every event type in the schema", () => {
    for (const type of ALL_EVENT_TYPES) {
      expect(EVENT_TEMPLATES[type], `missing template: ${type}`).toBeDefined();
    }
  });

  it("has budget weights summing to exactly 1", () => {
    for (const type of ALL_EVENT_TYPES) {
      const sum = EVENT_TEMPLATES[type].budget.reduce(
        (a, b) => a + b.weight,
        0,
      );
      expect(sum, `weights for ${type}`).toBeCloseTo(1, 10);
    }
  });

  it("allocates budget to every category it marks required", () => {
    // Otherwise a host is told to book something the budget never funded.
    for (const type of ALL_EVENT_TYPES) {
      const template = EVENT_TEMPLATES[type];
      const funded = new Set(template.budget.map((b) => b.category));
      for (const required of template.required) {
        expect(funded.has(required), `${type} requires unfunded ${required}`)
          .toBe(true);
      }
    }
  });

  it("keeps task positions inside the horizon", () => {
    for (const type of ALL_EVENT_TYPES) {
      for (const task of EVENT_TEMPLATES[type].extraTasks) {
        expect(task.at, `${type}: ${task.title}`).toBeGreaterThanOrEqual(0);
        expect(task.at, `${type}: ${task.title}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("generatePlan — budget", () => {
  it("splits the budget without losing a cent", () => {
    const plan = generatePlan(
      { type: "FUNDRAISER", date: inDays(100), budgetTotalCents: 2_500_000 },
      NOW,
    );
    const total = plan.categories.reduce((a, c) => a + c.allocatedCents, 0);
    expect(total).toBe(2_500_000);
  });

  it("conserves an awkward total that divides badly", () => {
    const plan = generatePlan(
      { type: "FUNDRAISER", date: inDays(100), budgetTotalCents: 1_000_001 },
      NOW,
    );
    const total = plan.categories.reduce((a, c) => a + c.allocatedCents, 0);
    expect(total).toBe(1_000_001);
  });

  it("gives the venue the largest share of a fundraiser", () => {
    const plan = generatePlan(
      { type: "FUNDRAISER", date: inDays(100), budgetTotalCents: 2_500_000 },
      NOW,
    );
    const top = [...plan.categories].sort(
      (a, b) => b.allocatedCents - a.allocatedCents,
    )[0];
    expect(top.category).toBe("VENUE");
  });

  it("puts catering above venue for a dinner party", () => {
    const plan = generatePlan(
      { type: "DINNER_PARTY", date: inDays(20), budgetTotalCents: 200_000 },
      NOW,
    );
    const top = [...plan.categories].sort(
      (a, b) => b.allocatedCents - a.allocatedCents,
    )[0];
    expect(top.category).toBe("CATERING");
  });

  it("produces zero allocations rather than NaN for a zero budget", () => {
    const plan = generatePlan(
      { type: "BIRTHDAY", date: inDays(30), budgetTotalCents: 0 },
      NOW,
    );
    expect(plan.categories.every((c) => c.allocatedCents === 0)).toBe(true);
  });
});

describe("generatePlan — timeline", () => {
  it("generates a booking task for every required category", () => {
    const plan = generatePlan(
      { type: "FUNDRAISER", date: inDays(100), budgetTotalCents: 2_500_000 },
      NOW,
    );
    for (const required of plan.required) {
      expect(
        plan.tasks.some((t) => t.category === required),
        `no task for ${required}`,
      ).toBe(true);
    }
  });

  it("orders tasks soonest-first", () => {
    const plan = generatePlan(
      { type: "FUNDRAISER", date: inDays(100), budgetTotalCents: 2_500_000 },
      NOW,
    );
    const offsets = plan.tasks.map((t) => t.offsetDays);
    expect(offsets).toEqual([...offsets].sort((a, b) => b - a));
  });

  it("never schedules a task before today, even on a rushed event", () => {
    // A fundraiser in six weeks: the 120-day template must compress, not emit
    // tasks that were due before the host ever opened the app.
    const plan = generatePlan(
      { type: "FUNDRAISER", date: inDays(42), budgetTotalCents: 2_500_000 },
      NOW,
    );
    for (const task of plan.tasks) {
      expect(task.dueDate!.getTime()).toBeGreaterThanOrEqual(
        startOfDay(NOW).getTime(),
      );
    }
  });

  it("compresses the horizon to the runway that actually exists", () => {
    const rushed = generatePlan(
      { type: "FUNDRAISER", date: inDays(42), budgetTotalCents: 2_500_000 },
      NOW,
    );
    const relaxed = generatePlan(
      { type: "FUNDRAISER", date: inDays(200), budgetTotalCents: 2_500_000 },
      NOW,
    );
    expect(rushed.horizonDays).toBe(42);
    expect(relaxed.horizonDays).toBe(120);
    // Same tasks, tighter spacing.
    expect(rushed.tasks.length).toBe(relaxed.tasks.length);
    expect(rushed.tasks[0].offsetDays).toBeLessThan(
      relaxed.tasks[0].offsetDays,
    );
  });

  it("does not stretch a short event out to the template horizon", () => {
    const plan = generatePlan(
      { type: "DINNER_PARTY", date: inDays(5), budgetTotalCents: 200_000 },
      NOW,
    );
    expect(plan.horizonDays).toBe(5);
    expect(Math.max(...plan.tasks.map((t) => t.offsetDays))).toBeLessThanOrEqual(5);
  });

  it("still produces a plan when no date is set", () => {
    const plan = generatePlan(
      { type: "BIRTHDAY", date: null, budgetTotalCents: 500_000 },
      NOW,
    );
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.tasks.every((t) => t.dueDate === null)).toBe(true);
    expect(plan.horizonDays).toBe(60);
  });

  it("collapses to everything-due-now for an event that already passed", () => {
    const plan = generatePlan(
      { type: "BIRTHDAY", date: inDays(-3), budgetTotalCents: 500_000 },
      NOW,
    );
    expect(plan.horizonDays).toBe(0);
    expect(plan.tasks.every((t) => t.offsetDays === 0)).toBe(true);
  });

  it("builds a plan for every event type without throwing", () => {
    for (const type of ALL_EVENT_TYPES) {
      const plan = generatePlan(
        { type, date: inDays(90), budgetTotalCents: 1_000_000 },
        NOW,
      );
      expect(plan.tasks.length, type).toBeGreaterThan(5);
      expect(plan.categories.length, type).toBeGreaterThan(2);
    }
  });
});

describe("daysBetween", () => {
  it("ignores time of day", () => {
    expect(
      daysBetween(new Date("2026-01-15T23:59:00"), new Date("2026-01-16T00:01:00")),
    ).toBe(1);
  });

  it("is negative for past dates", () => {
    expect(daysBetween(NOW, inDays(-5))).toBe(-5);
  });
});

describe("describeCountdown", () => {
  it("handles the near cases", () => {
    expect(describeCountdown(0)).toBe("Today");
    expect(describeCountdown(1)).toBe("Tomorrow");
    expect(describeCountdown(12)).toBe("in 12 days");
  });

  it("switches to months past six weeks", () => {
    expect(describeCountdown(90)).toBe("in 3 months");
  });

  it("handles the past and the missing", () => {
    expect(describeCountdown(-1)).toBe("Yesterday");
    expect(describeCountdown(-4)).toBe("4 days ago");
    expect(describeCountdown(null)).toBe("No date set");
  });
});
