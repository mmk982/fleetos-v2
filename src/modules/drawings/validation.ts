/**
 * Zod validation for drawing create/update (`PROJECT_PLAN.md` §11).
 *
 * Category create/update is deferred to Settings — not in this module.
 */
import { z } from "zod";
import { optionalTrimmedString } from "@/lib/validation/form-fields";

export const drawingCreateSchema = z.object({
  vesselId: z.string().uuid(),
  categoryId: z.string().uuid(),
  drawingName: z.string().trim().min(1).max(200),
  drawingNumber: optionalTrimmedString,
  revision: optionalTrimmedString,
  notes: optionalTrimmedString,
});

export const drawingUpdateSchema = z.object({
  vesselId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  drawingName: z.string().trim().min(1).max(200).optional(),
  drawingNumber: optionalTrimmedString,
  revision: optionalTrimmedString,
  notes: optionalTrimmedString,
});

export type DrawingCreateInput = z.infer<typeof drawingCreateSchema>;
export type DrawingUpdateInput = z.infer<typeof drawingUpdateSchema>;
