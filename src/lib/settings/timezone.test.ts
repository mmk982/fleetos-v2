import { describe, expect, it } from "vitest";
import {
  businessNowFor,
  isValidTimeZone,
  monthYearOfDay,
  todayInTimeZone,
} from "./timezone";

describe("todayInTimeZone", () => {
  // 21:30 UTC on 28 Oct is already 29 Oct in Dubai (UTC+4), still 28 Oct in UTC.
  const instant = new Date("2026-10-28T21:30:00Z");

  it("uses the company's calendar day", () => {
    expect(todayInTimeZone("Asia/Dubai", instant)).toBe("2026-10-29");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-10-28");
    expect(todayInTimeZone("America/Los_Angeles", instant)).toBe("2026-10-28");
  });

  it("falls back to the UTC day for missing or invalid zones", () => {
    expect(todayInTimeZone(null, instant)).toBe("2026-10-28");
    expect(todayInTimeZone("", instant)).toBe("2026-10-28");
    expect(todayInTimeZone("Not/AZone", instant)).toBe("2026-10-28");
  });
});

describe("businessNowFor", () => {
  it("returns UTC midnight of the company's day", () => {
    const now = businessNowFor("Asia/Dubai", new Date("2026-10-28T21:30:00Z"));
    expect(now.toISOString()).toBe("2026-10-29T00:00:00.000Z");
  });
});

describe("company day vs server-local day (business-day logic)", () => {
  // 23:30 UTC on 31 Jan is already 1 Feb in Dubai (UTC+4).
  const monthEndUtc = new Date("2026-01-31T23:30:00.000Z");

  it("rolls into the next month for Asia/Dubai at month end UTC", () => {
    expect(todayInTimeZone("Asia/Dubai", monthEndUtc)).toBe("2026-02-01");
    expect(todayInTimeZone("UTC", monthEndUtc)).toBe("2026-01-31");
    expect(businessNowFor("Asia/Dubai", monthEndUtc).toISOString()).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });

  it("selects the Feb 2026 period for dashboard-style month/year filters", () => {
    const day = todayInTimeZone("Asia/Dubai", monthEndUtc);
    expect(monthYearOfDay(day)).toEqual({ month: 2, year: 2026 });
    // Server-UTC behaviour (the bug) would still pick January.
    expect(monthYearOfDay(todayInTimeZone("UTC", monthEndUtc))).toEqual({
      month: 1,
      year: 2026,
    });
  });

  it("keeps the same calendar day mid-day in Dubai", () => {
    const midDay = new Date("2026-01-31T08:00:00.000Z"); // 12:00 Dubai
    expect(todayInTimeZone("Asia/Dubai", midDay)).toBe("2026-01-31");
    expect(monthYearOfDay(todayInTimeZone("Asia/Dubai", midDay))).toEqual({
      month: 1,
      year: 2026,
    });
  });

  it("rolls the year at New Year in Dubai", () => {
    const nye = new Date("2026-12-31T21:00:00.000Z"); // 01:00 1 Jan 2027 Dubai
    expect(monthYearOfDay(todayInTimeZone("Asia/Dubai", nye))).toEqual({
      month: 1,
      year: 2027,
    });
  });
});

describe("monthYearOfDay", () => {
  it("parses month and year as numbers", () => {
    expect(monthYearOfDay("2026-02-01")).toEqual({ month: 2, year: 2026 });
    expect(monthYearOfDay("2026-12-31")).toEqual({ month: 12, year: 2026 });
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA ids and rejects garbage", () => {
    expect(isValidTimeZone("Asia/Dubai")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Dubai time")).toBe(false);
  });
});
