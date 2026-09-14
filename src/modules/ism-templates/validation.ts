/**
 * Zod validation for ISM template create/update (`PROJECT_PLAN.md` §9).
 *
 * Category create/update is deferred to Settings — not in this module.
 */
import { z } from "zod";
import { ismTemplateStatusEnum } from "@/db/schema";
import { optionalTrimmedString } from "@/lib/validation/form-fields";

export const ismTemplateCreateSchema = z.object({
  formCode: z.string().trim().min(1).max(100),
  formName: z.string().trim().min(1).max(200),
  categoryId: z.string().uuid(),
  revision: optionalTrimmedString,
  status: z.enum(ismTemplateStatusEnum).default("active"),
});

export const ismTemplateUpdateSchema = z.object({
  formCode: z.string().trim().min(1).max(100).optional(),
  formName: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  revision: optionalTrimmedString,
  status: z.enum(ismTemplateStatusEnum).optional(),
});

export type IsmTemplateCreateInput = z.infer<typeof ismTemplateCreateSchema>;
export type IsmTemplateUpdateInput = z.infer<typeof ismTemplateUpdateSchema>;
