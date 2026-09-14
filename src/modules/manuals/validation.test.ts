/**
 * Zod boundary cases for manuals / revisions.
 */
import { describe, expect, it } from "vitest";
import {
  manualCreateSchema,
  manualRevisionCreateSchema,
  manualUpdateSchema,
} from "./validation";

const vesselId = "11111111-1111-4111-8111-111111111111";

describe("manualCreateSchema", () => {
  it("accepts a minimal valid create payload", () => {
    const parsed = manualCreateSchema.safeParse({
      vesselId,
      title: "ISM Manual",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty title", () => {
    const parsed = manualCreateSchema.safeParse({
      vesselId,
      title: "  ",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid vesselId", () => {
    const parsed = manualCreateSchema.safeParse({
      vesselId: "bad",
      title: "ISM Manual",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("manualUpdateSchema", () => {
  it("allows partial updates", () => {
    const parsed = manualUpdateSchema.safeParse({ department: "Deck" });
    expect(parsed.success).toBe(true);
  });
});

describe("manualRevisionCreateSchema", () => {
  it("requires manualId uuid", () => {
    const ok = manualRevisionCreateSchema.safeParse({
      manualId: vesselId,
      revisionNumber: "Rev A",
    });
    expect(ok.success).toBe(true);

    const bad = manualRevisionCreateSchema.safeParse({
      manualId: "nope",
    });
    expect(bad.success).toBe(false);
  });
});
