/**
 * Zod validation for PSC inspection create/update (`PROJECT_PLAN.md` §7b).
 */
import { z } from "zod";
import { pscInspectionResultEnum } from "@/db/schema";
import {
  formBoolean,
  optionalTrimmedString,
} from "@/lib/validation/form-fields";

export const pscInspectionCreateSchema = z.object({
  vesselId: z.string().uuid(),
  port: z.string().trim().min(1).max(200),
  inspectionDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  authority: z.string().trim().min(1).max(200),
  result: z.enum(pscInspectionResultEnum),
  detained: formBoolean.default(false),
  inspectorName: optionalTrimmedString,
  notes: optionalTrimmedString,
});

/** Explicit optional fields — Zod 4 rejects `.partial()` on preprocess schemas. */
export const pscInspectionUpdateSchema = z.object({
  vesselId: z.string().uuid().optional(),
  port: z.string().trim().min(1).max(200).optional(),
  inspectionDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
  authority: z.string().trim().min(1).max(200).optional(),
  result: z.enum(pscInspectionResultEnum).optional(),
  detained: formBoolean.optional(),
  inspectorName: optionalTrimmedString,
  notes: optionalTrimmedString,
});

export type PscInspectionCreateInput = z.infer<typeof pscInspectionCreateSchema>;
export type PscInspectionUpdateInput = z.infer<typeof pscInspectionUpdateSchema>;
