/**
 * Zod validation for crew members and crew certificates (`PROJECT_PLAN.md` §3).
 */
import { z } from "zod";
import { crewStatusEnum } from "@/db/schema";
import {
  isoDateField,
  optionalTrimmedString,
  optionalUuid,
} from "@/lib/validation/form-fields";

export const crewMemberCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  categoryId: optionalUuid,
  nationality: optionalTrimmedString,
  dateOfBirth: isoDateField,
  vesselId: optionalUuid,
  status: z.enum(crewStatusEnum).default("active"),
  notes: optionalTrimmedString,
});

export const crewMemberUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  categoryId: optionalUuid,
  nationality: optionalTrimmedString,
  dateOfBirth: isoDateField,
  vesselId: optionalUuid,
  status: z.enum(crewStatusEnum).optional(),
  notes: optionalTrimmedString,
});

export const crewCertificateCreateSchema = z
  .object({
    crewMemberId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    documentNumber: optionalTrimmedString,
    issuingAuthority: optionalTrimmedString,
    endorsementTypeId: optionalUuid,
    issueDate: isoDateField,
    expiryDate: isoDateField,
    notes: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    if (data.issueDate && data.expiryDate && data.expiryDate < data.issueDate) {
      ctx.addIssue({
        code: "custom",
        message: "Expiry date must be on or after issue date",
        path: ["expiryDate"],
      });
    }
  });

export const crewCertificateUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    documentNumber: optionalTrimmedString,
    issuingAuthority: optionalTrimmedString,
    endorsementTypeId: optionalUuid,
    issueDate: isoDateField,
    expiryDate: isoDateField,
    notes: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    if (data.issueDate && data.expiryDate && data.expiryDate < data.issueDate) {
      ctx.addIssue({
        code: "custom",
        message: "Expiry date must be on or after issue date",
        path: ["expiryDate"],
      });
    }
  });

export type CrewMemberCreateInput = z.infer<typeof crewMemberCreateSchema>;
export type CrewMemberUpdateInput = z.infer<typeof crewMemberUpdateSchema>;
export type CrewCertificateCreateInput = z.infer<
  typeof crewCertificateCreateSchema
>;
export type CrewCertificateUpdateInput = z.infer<
  typeof crewCertificateUpdateSchema
>;
