/**
 * Zod boundary cases for reminder create/update.
 */
import { describe, expect, it } from "vitest";
import { reminderCreateSchema, reminderUpdateSchema } from "./validation";

describe("reminderCreateSchema", () => {
  it("accepts a minimal valid payload with default priority", () => {
    const parsed = reminderCreateSchema.safeParse({
      title: "Check P&I",
      type: "insurance",
      reminderDate: "2026-07-01",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.priority).toBe("medium");
    }
  });

  it("rejects empty title", () => {
    const parsed = reminderCreateSchema.safeParse({
      title: "  ",
      type: "custom",
      reminderDate: "2026-07-01",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects missing reminderDate", () => {
    const parsed = reminderCreateSchema.safeParse({
      title: "Follow up",
      type: "deficiency",
    });
    expect(parsed.success).toBe(false);
  });

  it("allows fleet-wide (no vesselId) and optional related item", () => {
    const parsed = reminderCreateSchema.safeParse({
      title: "Fleet drill",
      type: "custom",
      reminderDate: "2026-08-15",
      relatedItemKind: "certificate",
      relatedItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("reminderUpdateSchema", () => {
  it("allows partial updates", () => {
    const parsed = reminderUpdateSchema.safeParse({ priority: "high" });
    expect(parsed.success).toBe(true);
  });
});
