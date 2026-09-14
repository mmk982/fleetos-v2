/**
 * Zod boundary cases for monthly forms validation.
 */
import { describe, expect, it } from "vitest";
import {
  monthlyFormCreateSchema,
  monthlyFormRequirementCreateSchema,
} from "./validation";

const vesselId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const templateId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("monthlyFormRequirementCreateSchema", () => {
  it("accepts a minimal create payload", () => {
    const parsed = monthlyFormRequirementCreateSchema.safeParse({
      vesselId,
      ismTemplateId: templateId,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.frequency).toBe("monthly");
      expect(parsed.data.activeStatus).toBe(true);
    }
  });
});

describe("monthlyFormCreateSchema", () => {
  it("requires formName when ismTemplateId is omitted", () => {
    const parsed = monthlyFormCreateSchema.safeParse({
      vesselId,
      month: 3,
      year: 2026,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts template-only ad-hoc create (name filled from template later)", () => {
    const parsed = monthlyFormCreateSchema.safeParse({
      vesselId,
      ismTemplateId: templateId,
      month: 3,
      year: 2026,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects month outside 1–12", () => {
    const parsed = monthlyFormCreateSchema.safeParse({
      vesselId,
      formName: "Ad hoc",
      month: 13,
      year: 2026,
    });
    expect(parsed.success).toBe(false);
  });
});
