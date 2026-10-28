/**
 * Fail-closed cron Authorization checks.
 */
import { describe, expect, it } from "vitest";
import { isValidCronAuth } from "./cron-auth";

const GOOD_SECRET = "a".repeat(32);

describe("isValidCronAuth", () => {
  it("rejects when secret is undefined even if header is Bearer undefined", () => {
    expect(isValidCronAuth("Bearer undefined", undefined)).toBe(false);
  });

  it("rejects secrets shorter than 32 characters", () => {
    expect(isValidCronAuth(`Bearer ${"x".repeat(31)}`, "x".repeat(31))).toBe(
      false,
    );
  });

  it("rejects a wrong token", () => {
    expect(isValidCronAuth(`Bearer ${"b".repeat(32)}`, GOOD_SECRET)).toBe(
      false,
    );
  });

  it("rejects a different-length token without throwing", () => {
    expect(isValidCronAuth("Bearer short", GOOD_SECRET)).toBe(false);
  });

  it("rejects a missing Authorization header", () => {
    expect(isValidCronAuth(null, GOOD_SECRET)).toBe(false);
  });

  it("accepts the correct Bearer token when the secret is 32+ chars", () => {
    expect(isValidCronAuth(`Bearer ${GOOD_SECRET}`, GOOD_SECRET)).toBe(true);
  });
});
