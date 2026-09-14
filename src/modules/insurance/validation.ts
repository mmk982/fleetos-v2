/**
 * Zod validation for insurance create/update (`PROJECT_PLAN.md` §4).
 *
 * `cachedStatus` is never accepted as user input — controllers recompute it
 * via `deriveComplianceStatus` on every write.
 */
import { z } from "zod";
import { insuranceTypeEnum } from "@/db/schema";
import {
  isoDateField,
  optionalPositiveInt,
  optionalTrimmedString,
} from "@/lib/validation/form-fields";

/** Optional ISO 4217 currency code (exactly 3 letters), empty → null. */
const optionalCurrency = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  if (typeof val !== "string") {
    return undefined;
  }
  const trimmed = val.trim().toUpperCase();
  return trimmed.length === 0 ? null : trimmed;
}, z.union([z.null(), z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter ISO currency")]).optional());

function refineDates(
  data: { startDate?: string | null; expiryDate?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.startDate && data.expiryDate && data.expiryDate < data.startDate) {
    ctx.addIssue({
      code: "custom",
      message: "Expiry date must be on or after start date",
      path: ["expiryDate"],
    });
  }
}

export const insuranceCreateSchema = z
  .object({
    vesselId: z.string().uuid(),
    policyType: z.enum(insuranceTypeEnum),
    provider: optionalTrimmedString,
    policyNumber: optionalTrimmedString,
    coverageAmount: optionalPositiveInt,
    currency: optionalCurrency,
    startDate: isoDateField,
    expiryDate: isoDateField,
    notes: optionalTrimmedString,
  })
  .superRefine(refineDates);

export const insuranceUpdateSchema = z
  .object({
    vesselId: z.string().uuid().optional(),
    policyType: z.enum(insuranceTypeEnum).optional(),
    provider: optionalTrimmedString,
    policyNumber: optionalTrimmedString,
    coverageAmount: optionalPositiveInt,
    currency: optionalCurrency,
    startDate: isoDateField,
    expiryDate: isoDateField,
    notes: optionalTrimmedString,
  })
  .superRefine(refineDates);

export type InsuranceCreateInput = z.infer<typeof insuranceCreateSchema>;
export type InsuranceUpdateInput = z.infer<typeof insuranceUpdateSchema>;
