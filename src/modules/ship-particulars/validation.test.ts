/**
 * Zod boundary cases for particulars / notes validation.
 */
import { describe, expect, it } from "vitest";
import {
  particularsCreateSchema,
  particularsUpdateSchema,
  vesselNoteCreateSchema,
} from "./validation";

const vesselId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("particularsCreateSchema", () => {
  it("accepts vesselId-only create (isCurrent defaults true)", () => {
    const parsed = particularsCreateSchema.safeParse({ vesselId });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isCurrent).toBe(true);
    }
  });

  it("accepts decimal lengthOverall", () => {
    const parsed = particularsCreateSchema.safeParse({
      vesselId,
      lengthOverall: "161.21",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lengthOverall).toBe(161.21);
    }
  });

  it("rejects non-positive tonnage", () => {
    const parsed = particularsCreateSchema.safeParse({
      vesselId,
      deadweightTonnage: 0,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("particularsUpdateSchema", () => {
  it("allows partial updates without isCurrent", () => {
    const parsed = particularsUpdateSchema.safeParse({ owner: "Acme" });
    expect(parsed.success).toBe(true);
  });
});

describe("vesselNoteCreateSchema", () => {
  it("requires non-empty body", () => {
    expect(
      vesselNoteCreateSchema.safeParse({ vesselId, body: "  " }).success,
    ).toBe(false);
    expect(
      vesselNoteCreateSchema.safeParse({ vesselId, body: "Hello" }).success,
    ).toBe(true);
  });
});
