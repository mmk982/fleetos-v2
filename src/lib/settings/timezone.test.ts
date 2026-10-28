import { describe, expect, it } from "vitest";
import {
  businessNowFor,
  isValidTimeZone,
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

describe("isValidTimeZone", () => {
  it("accepts IANA ids and rejects garbage", () => {
    expect(isValidTimeZone("Asia/Dubai")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Dubai time")).toBe(false);
  });
});
