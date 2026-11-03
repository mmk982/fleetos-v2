/**
 * Unit tests for {@link deriveMonthlyFormDisplayStatus} / {@link lastDayOfMonth}.
 */
import { describe, expect, it } from "vitest";
import {
  deriveMonthlyFormDisplayStatus,
  lastDayOfMonth,
} from "./monthly-form-status";

describe("lastDayOfMonth", () => {
  it("returns the last calendar day for January and December (UTC)", () => {
    expect(lastDayOfMonth(2026, 1).getUTCDate()).toBe(31);
    expect(lastDayOfMonth(2026, 1).getUTCMonth()).toBe(0);
    expect(lastDayOfMonth(2026, 12).getUTCDate()).toBe(31);
    expect(lastDayOfMonth(2026, 12).getUTCMonth()).toBe(11);
  });

  it("handles February in a leap year", () => {
    expect(lastDayOfMonth(2024, 2).getUTCDate()).toBe(29);
  });

  it("is stable across a non-UTC process TZ at a month boundary (A-17)", () => {
    const prev = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      // March 2026 ends on the 31st — must not roll into April under PST/PDT.
      const end = lastDayOfMonth(2026, 3);
      expect(end.getUTCFullYear()).toBe(2026);
      expect(end.getUTCMonth()).toBe(2);
      expect(end.getUTCDate()).toBe(31);

      expect(deriveMonthlyFormDisplayStatus("pending", 3, 2026, end)).toBe(
        "pending",
      );
      expect(
        deriveMonthlyFormDisplayStatus(
          "pending",
          3,
          2026,
          new Date(end.getTime() + 1),
        ),
      ).toBe("overdue");
    } finally {
      if (prev === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = prev;
      }
    }
  });
});

describe("deriveMonthlyFormDisplayStatus", () => {
  it("returns submitted regardless of the calendar", () => {
    const past = new Date(Date.UTC(2099, 0, 1));
    expect(
      deriveMonthlyFormDisplayStatus("submitted", 1, 2020, past),
    ).toBe("submitted");
  });

  it("returns pending when now is exactly the last day of the month", () => {
    const end = lastDayOfMonth(2026, 3);
    expect(deriveMonthlyFormDisplayStatus("pending", 3, 2026, end)).toBe(
      "pending",
    );
  });

  it("returns overdue one moment after the last day of the month", () => {
    const end = lastDayOfMonth(2026, 3);
    const past = new Date(end.getTime() + 1);
    expect(deriveMonthlyFormDisplayStatus("pending", 3, 2026, past)).toBe(
      "overdue",
    );
  });

  it("returns pending while still inside the due month", () => {
    const mid = new Date(Date.UTC(2026, 2, 15)); // March 15
    expect(deriveMonthlyFormDisplayStatus("pending", 3, 2026, mid)).toBe(
      "pending",
    );
  });
});
