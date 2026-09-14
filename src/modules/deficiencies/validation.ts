/**
 * Zod validation for deficiency create/update (`PROJECT_PLAN.md` §2).
 *
 * `status === "closed"` without `closedDate` defaults closedDate to today
 * at parse time so controllers do not invent that rule ad hoc.
 */
import { z } from "zod";
import { deficiencySourceEnum, deficiencyStatusEnum } from "@/db/schema";
import {
  isoDateField,
  optionalTrimmedString,
} from "@/lib/validation/form-fields";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const deficiencyCreateSchema = z
  .object({
    vesselId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    source: z.enum(deficiencySourceEnum),
    status: z.enum(deficiencyStatusEnum).default("open"),
    deficiencyNumber: optionalTrimmedString,
    category: optionalTrimmedString,
    description: optionalTrimmedString,
    reference: optionalTrimmedString,
    identifiedDate: isoDateField,
    dueDate: isoDateField,
    closedDate: isoDateField,
    correctiveAction: optionalTrimmedString,
    responsiblePerson: optionalTrimmedString,
    notes: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    if (
      data.identifiedDate &&
      data.dueDate &&
      data.dueDate < data.identifiedDate
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Due date must be on or after identified date",
        path: ["dueDate"],
      });
    }
  })
  .transform((data) => {
    if (data.status === "closed" && (data.closedDate == null || data.closedDate === undefined)) {
      return { ...data, closedDate: todayIso() };
    }
    return data;
  });

export const deficiencyUpdateSchema = z
  .object({
    vesselId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    source: z.enum(deficiencySourceEnum).optional(),
    status: z.enum(deficiencyStatusEnum).optional(),
    deficiencyNumber: optionalTrimmedString,
    category: optionalTrimmedString,
    description: optionalTrimmedString,
    reference: optionalTrimmedString,
    identifiedDate: isoDateField,
    dueDate: isoDateField,
    closedDate: isoDateField,
    correctiveAction: optionalTrimmedString,
    responsiblePerson: optionalTrimmedString,
    notes: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    if (
      data.identifiedDate &&
      data.dueDate &&
      data.dueDate < data.identifiedDate
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Due date must be on or after identified date",
        path: ["dueDate"],
      });
    }
  })
  .transform((data) => {
    if (
      data.status === "closed" &&
      (data.closedDate === undefined || data.closedDate === null)
    ) {
      return { ...data, closedDate: todayIso() };
    }
    return data;
  });

export type DeficiencyCreateInput = z.infer<typeof deficiencyCreateSchema>;
export type DeficiencyUpdateInput = z.infer<typeof deficiencyUpdateSchema>;
