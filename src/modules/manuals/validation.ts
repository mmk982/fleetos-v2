/**
 * Zod validation for manuals and revisions (`PROJECT_PLAN.md` §8).
 *
 * File bytes are validated in the controller/action (MIME + size), not here.
 */
import { z } from "zod";
import {
  isoDateField,
  optionalTrimmedString,
} from "@/lib/validation/form-fields";

export const manualCreateSchema = z.object({
  vesselId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  manualType: optionalTrimmedString,
  department: optionalTrimmedString,
  notes: optionalTrimmedString,
});

export const manualUpdateSchema = z.object({
  vesselId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  manualType: optionalTrimmedString,
  department: optionalTrimmedString,
  notes: optionalTrimmedString,
});

export const manualRevisionCreateSchema = z.object({
  manualId: z.string().uuid(),
  revisionNumber: optionalTrimmedString,
  revisionDate: isoDateField,
});

export type ManualCreateInput = z.infer<typeof manualCreateSchema>;
export type ManualUpdateInput = z.infer<typeof manualUpdateSchema>;
export type ManualRevisionCreateInput = z.infer<
  typeof manualRevisionCreateSchema
>;
