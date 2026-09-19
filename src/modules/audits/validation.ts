/**
 * Zod validation for audit create/update.
 *
 * Explicit optional fields on update — Zod 4 rejects `.partial()` on
 * preprocess schemas (same convention as PSC).
 */
import { z } from "zod";
import { auditTypeEnum } from "@/db/schema";
import { optionalTrimmedString } from "@/lib/validation/form-fields";

export const auditCreateSchema = z.object({
  vesselId: z.string().uuid(),
  auditType: z.enum(auditTypeEnum),
  auditDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  auditor: optionalTrimmedString,
  findingsCount: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return 0;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }, z.number().int().min(0)),
  notes: optionalTrimmedString,
});

export const auditUpdateSchema = z.object({
  vesselId: z.string().uuid().optional(),
  auditType: z.enum(auditTypeEnum).optional(),
  auditDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
  auditor: optionalTrimmedString,
  findingsCount: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return undefined;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }, z.number().int().min(0).optional()),
  notes: optionalTrimmedString,
});

export type AuditCreateInput = z.infer<typeof auditCreateSchema>;
export type AuditUpdateInput = z.infer<typeof auditUpdateSchema>;
