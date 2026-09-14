/**
 * Zod validation for Monthly Executed Forms (`PROJECT_PLAN.md` §10).
 */
import { z } from "zod";
import {
  monthlyFormFrequencyEnum,
} from "@/db/schema";
import { optionalTrimmedString } from "@/lib/validation/form-fields";

export const monthlyFormRequirementCreateSchema = z.object({
  vesselId: z.string().uuid(),
  ismTemplateId: z.string().uuid(),
  frequency: z.enum(monthlyFormFrequencyEnum).default("monthly"),
  activeStatus: z.boolean().default(true),
});

export const monthlyFormRequirementUpdateSchema = z.object({
  vesselId: z.string().uuid().optional(),
  ismTemplateId: z.string().uuid().optional(),
  frequency: z.enum(monthlyFormFrequencyEnum).optional(),
  activeStatus: z.boolean().optional(),
});

export const monthlyFormCreateSchema = z
  .object({
    vesselId: z.string().uuid(),
    ismTemplateId: z.string().uuid().optional().nullable(),
    formName: optionalTrimmedString,
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100),
    remarks: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    const hasTemplate =
      data.ismTemplateId !== null &&
      data.ismTemplateId !== undefined &&
      data.ismTemplateId.length > 0;
    const hasName =
      data.formName !== null &&
      data.formName !== undefined &&
      data.formName.trim().length > 0;
    if (!hasTemplate && !hasName) {
      ctx.addIssue({
        code: "custom",
        message: "Provide a form name when no ISM template is selected.",
        path: ["formName"],
      });
    }
  });

export const monthlyFormSubmitSchema = z.object({
  remarks: optionalTrimmedString,
});

export const monthlyFormGenerateSchema = z.object({
  vesselId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type MonthlyFormRequirementCreateInput = z.infer<
  typeof monthlyFormRequirementCreateSchema
>;
export type MonthlyFormRequirementUpdateInput = z.infer<
  typeof monthlyFormRequirementUpdateSchema
>;
export type MonthlyFormCreateInput = z.infer<typeof monthlyFormCreateSchema>;
export type MonthlyFormSubmitInput = z.infer<typeof monthlyFormSubmitSchema>;
export type MonthlyFormGenerateInput = z.infer<typeof monthlyFormGenerateSchema>;
