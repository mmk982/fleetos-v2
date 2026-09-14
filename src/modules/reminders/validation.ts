/**
 * Zod validation for reminders create/update (`PROJECT_PLAN.md` §12).
 */
import { z } from "zod";
import {
  reminderPriorityEnum,
  reminderStatusEnum,
  reminderTypeEnum,
} from "@/db/schema";
import {
  isoDateField,
  optionalTrimmedString,
  optionalUuid,
} from "@/lib/validation/form-fields";

/** Required ISO date (empty rejected). */
const requiredIsoDate = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return undefined;
  }
  if (typeof val !== "string") return undefined;
  return val.trim();
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"));

export const reminderCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(reminderTypeEnum),
  priority: z.enum(reminderPriorityEnum).default("medium"),
  reminderDate: requiredIsoDate,
  vesselId: optionalUuid,
  relatedItemKind: optionalTrimmedString,
  relatedItemId: optionalUuid,
  notes: optionalTrimmedString,
});

export const reminderUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  type: z.enum(reminderTypeEnum).optional(),
  priority: z.enum(reminderPriorityEnum).optional(),
  reminderDate: isoDateField,
  vesselId: optionalUuid,
  relatedItemKind: optionalTrimmedString,
  relatedItemId: optionalUuid,
  notes: optionalTrimmedString,
  status: z.enum(reminderStatusEnum).optional(),
});

export type ReminderCreateInput = z.infer<typeof reminderCreateSchema>;
export type ReminderUpdateInput = z.infer<typeof reminderUpdateSchema>;
