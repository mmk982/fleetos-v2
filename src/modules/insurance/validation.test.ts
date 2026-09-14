/**
 * Zod boundary cases for insurance create/update.
 */
import { describe, expect, it } from "vitest";
import {
  insuranceCreateSchema,
  insuranceUpdateSchema,
} from "./validation";

const base = {
  vesselId: "11111111-1111-4111-8111-111111111111",
  policyType: "pi" as const,
};

describe("insuranceCreateSchema", () => {
  it("accepts a minimal valid create payload", () => {
    const parsed = insuranceCreateSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("rejects expiryDate before startDate", () => {
    const parsed = insuranceCreateSchema.safeParse({
      ...base,
      startDate: "2026-06-01",
      expiryDate: "2026-05-01",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) => i.path[0] === "expiryDate"),
      ).toBe(true);
    }
  });

  it("accepts expiryDate equal to startDate", () => {
    const parsed = insuranceCreateSchema.safeParse({
      ...base,
      startDate: "2026-06-01",
      expiryDate: "2026-06-01",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects currency that is not exactly 3 letters", () => {
    for (const currency of ["US", "USDD", "12$", "usd1"]) {
      const parsed = insuranceCreateSchema.safeParse({ ...base, currency });
      expect(parsed.success, currency).toBe(false);
    }
  });

  it("normalizes currency to uppercase and accepts ISO codes", () => {
    const parsed = insuranceCreateSchema.safeParse({
      ...base,
      currency: "usd",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currency).toBe("USD");
    }
  });

  it("rejects non-positive coverageAmount", () => {
    const parsed = insuranceCreateSchema.safeParse({
      ...base,
      coverageAmount: "0",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("insuranceUpdateSchema", () => {
  it("allows partial updates", () => {
    const parsed = insuranceUpdateSchema.safeParse({ notes: "renewed" });
    expect(parsed.success).toBe(true);
  });

  it("rejects expiryDate < startDate on update when both present", () => {
    const parsed = insuranceUpdateSchema.safeParse({
      startDate: "2026-12-01",
      expiryDate: "2026-01-01",
    });
    expect(parsed.success).toBe(false);
  });
});
