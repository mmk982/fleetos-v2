/**
 * Zod validation for certificate create/update, events, and reference-data
 * shapes. Uses shared form-field helpers from `@/lib/validation/form-fields`
 * (`PROJECT_PLAN.md` §1 Zod + Cross-cutting notes).
 *
 * `cachedStatus` is never accepted as user input — controllers recompute it
 * via `deriveComplianceStatus` on every write.
 */
import { z } from "zod";
import {
  certificateAuthorityEnum,
  certificateEventTypeEnum,
  certificateLifecycleEnum,
  reminderRuleKindEnum,
} from "@/db/schema";
import {
  formBoolean,
  isoDateField,
  optionalPositiveInt,
  optionalTrimmedString,
  optionalUuid,
} from "@/lib/validation/form-fields";

/** Create a certificate type (Settings CRUD; `isCustom` defaults true). */
export const certificateTypeCreateSchema = z
  .object({
    authority: z.enum(certificateAuthorityEnum),
    name: z.string().trim().min(1).max(200),
    ruleKind: z.enum(reminderRuleKindEnum).default("expiry_offset"),
    offsetDays: optionalPositiveInt,
    isCustom: formBoolean.default(true),
  })
  .superRefine((data, ctx) => {
    if (data.ruleKind === "expiry_offset" && (data.offsetDays == null || data.offsetDays <= 0)) {
      ctx.addIssue({
        code: "custom",
        message: "offsetDays is required when ruleKind is expiry_offset",
        path: ["offsetDays"],
      });
    }
  });

/** Explicit optional fields — Zod 4 rejects `.partial()` on refined schemas. */
export const certificateTypeUpdateSchema = z
  .object({
    authority: z.enum(certificateAuthorityEnum).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    ruleKind: z.enum(reminderRuleKindEnum).optional(),
    offsetDays: optionalPositiveInt,
    isCustom: formBoolean.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.ruleKind === "expiry_offset" &&
      data.offsetDays !== undefined &&
      (data.offsetDays == null || data.offsetDays <= 0)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "offsetDays is required when ruleKind is expiry_offset",
        path: ["offsetDays"],
      });
    }
  });

export const issuingAuthorityCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isCustom: formBoolean.default(true),
});

export const issuingAuthorityUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  isCustom: formBoolean.optional(),
});

/** Full certificate-creation input. */
export const certificateCreateSchema = z
  .object({
    vesselId: z.string().uuid(),
    certificateTypeId: z.string().uuid(),
    parentCertificateId: optionalUuid,
    issuingAuthorityId: optionalUuid,
    certificateNumber: optionalTrimmedString,
    issueDate: isoDateField,
    expiryDate: isoDateField,
    windowOpenDate: isoDateField,
    windowCloseDate: isoDateField,
    linkedToDryDock: formBoolean.default(false),
    customOffsetDays: optionalPositiveInt,
    lifecycleStatus: z.enum(certificateLifecycleEnum).default("active"),
    remarks: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    if (data.issueDate && data.expiryDate && data.expiryDate < data.issueDate) {
      ctx.addIssue({
        code: "custom",
        message: "Expiry date must be on or after issue date",
        path: ["expiryDate"],
      });
    }
    if (
      data.windowOpenDate &&
      data.windowCloseDate &&
      data.windowCloseDate < data.windowOpenDate
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Window close must be on or after window open",
        path: ["windowCloseDate"],
      });
    }
  });

/** Explicit optional fields — Zod 4 rejects `.partial()` on refined schemas. */
export const certificateUpdateSchema = z
  .object({
    vesselId: z.string().uuid().optional(),
    certificateTypeId: z.string().uuid().optional(),
    parentCertificateId: optionalUuid,
    issuingAuthorityId: optionalUuid,
    certificateNumber: optionalTrimmedString,
    issueDate: isoDateField,
    expiryDate: isoDateField,
    windowOpenDate: isoDateField,
    windowCloseDate: isoDateField,
    linkedToDryDock: formBoolean.optional(),
    customOffsetDays: optionalPositiveInt,
    lifecycleStatus: z.enum(certificateLifecycleEnum).optional(),
    remarks: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    if (data.issueDate && data.expiryDate && data.expiryDate < data.issueDate) {
      ctx.addIssue({
        code: "custom",
        message: "Expiry date must be on or after issue date",
        path: ["expiryDate"],
      });
    }
    if (
      data.windowOpenDate &&
      data.windowCloseDate &&
      data.windowCloseDate < data.windowOpenDate
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Window close must be on or after window open",
        path: ["windowCloseDate"],
      });
    }
  });

export const certificateEventCreateSchema = z.object({
  certificateId: z.string().uuid(),
  eventType: z.enum(certificateEventTypeEnum),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  newExpiryDate: isoDateField,
  note: optionalTrimmedString,
});

export type CertificateTypeCreateInput = z.infer<typeof certificateTypeCreateSchema>;
export type CertificateTypeUpdateInput = z.infer<typeof certificateTypeUpdateSchema>;
export type IssuingAuthorityCreateInput = z.infer<typeof issuingAuthorityCreateSchema>;
export type IssuingAuthorityUpdateInput = z.infer<typeof issuingAuthorityUpdateSchema>;
export type CertificateCreateInput = z.infer<typeof certificateCreateSchema>;
export type CertificateUpdateInput = z.infer<typeof certificateUpdateSchema>;
export type CertificateEventCreateInput = z.infer<typeof certificateEventCreateSchema>;
