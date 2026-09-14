/**
 * Unit tests for {@link deriveMonthlyFormDisplayStatus} / {@link lastDayOfMonth}.
 */
import { describe, expect, it } from "vitest";
import {
  deriveMonthlyFormDisplayStatus,
  lastDayOfMonth,
} from "./monthly-form-status";

describe("lastDayOfMonth", () => {
  it("returns the last calendar day for January and December", () => {
    expect(lastDayOfMonth(2026, 1).getDate()).toBe(31);
    expect(lastDayOfMonth(2026, 1).getMonth()).toBe(0);
    expect(lastDayOfMonth(2026, 12).getDate()).toBe(31);
    expect(lastDayOfMonth(2026, 12).getMonth()).toBe(11);
  });

  it("handles February in a leap year", () => {
    expect(lastDayOfMonth(2024, 2).getDate()).toBe(29);
  });
});

describe("deriveMonthlyFormDisplayStatus", () => {
  it("returns submitted regardless of the calendar", () => {
    const past = new Date(2099, 0, 1);
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
    const mid = new Date(2026, 2, 15); // March 15 (0-based month index 2)
    expect(deriveMonthlyFormDisplayStatus("pending", 3, 2026, mid)).toBe(
      "pending",
    );
  });
});
