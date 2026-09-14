/**
 * Zod boundary cases for drawing create/update.
 */
import { describe, expect, it } from "vitest";
import { drawingCreateSchema, drawingUpdateSchema } from "./validation";

const validVesselId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const validCategoryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("drawingCreateSchema", () => {
  it("accepts a minimal valid create payload", () => {
    const parsed = drawingCreateSchema.safeParse({
      vesselId: validVesselId,
      categoryId: validCategoryId,
      drawingName: "GA Plan",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty drawingName", () => {
    const parsed = drawingCreateSchema.safeParse({
      vesselId: validVesselId,
      categoryId: validCategoryId,
      drawingName: "  ",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "drawingName")).toBe(
        true,
      );
    }
  });

  it("rejects vesselId / categoryId that are not uuids", () => {
    const parsed = drawingCreateSchema.safeParse({
      vesselId: "bad",
      categoryId: "also-bad",
      drawingName: "Fire plan",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("vesselId");
      expect(paths).toContain("categoryId");
    }
  });
});

describe("drawingUpdateSchema", () => {
  it("allows partial updates", () => {
    const parsed = drawingUpdateSchema.safeParse({ revision: "Rev B" });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid categoryId on update", () => {
    const parsed = drawingUpdateSchema.safeParse({ categoryId: "bad" });
    expect(parsed.success).toBe(false);
  });
});
