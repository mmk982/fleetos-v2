/**
 * Zod boundary cases for ISM template create/update.
 */
import { describe, expect, it } from "vitest";
import {
  ismTemplateCreateSchema,
  ismTemplateUpdateSchema,
} from "./validation";

const validCategoryId = "11111111-1111-4111-8111-111111111111";

describe("ismTemplateCreateSchema", () => {
  it("accepts a minimal valid create payload", () => {
    const parsed = ismTemplateCreateSchema.safeParse({
      formCode: "DRILL-01",
      formName: "Fire drill checklist",
      categoryId: validCategoryId,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("active");
    }
  });

  it("rejects empty formCode and formName", () => {
    const parsed = ismTemplateCreateSchema.safeParse({
      formCode: "  ",
      formName: "",
      categoryId: validCategoryId,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("formCode");
      expect(paths).toContain("formName");
    }
  });

  it("rejects categoryId that is not a uuid", () => {
    const parsed = ismTemplateCreateSchema.safeParse({
      formCode: "SAFE-01",
      formName: "Safety form",
      categoryId: "not-a-uuid",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "categoryId")).toBe(
        true,
      );
    }
  });
});

describe("ismTemplateUpdateSchema", () => {
  it("allows partial updates", () => {
    const parsed = ismTemplateUpdateSchema.safeParse({ status: "draft" });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid categoryId on update", () => {
    const parsed = ismTemplateUpdateSchema.safeParse({
      categoryId: "bad",
    });
    expect(parsed.success).toBe(false);
  });
});
