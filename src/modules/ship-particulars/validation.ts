/**
 * Zod validation for Ship Particulars + vessel notes (`PROJECT_PLAN.md` §13).
 */
import { z } from "zod";
import {
  isoDateField,
  optionalPositiveInt,
  optionalPositiveNumber,
  optionalTrimmedString,
} from "@/lib/validation/form-fields";

const particularsFields = {
  classSociety: optionalTrimmedString,
  portOfRegistry: optionalTrimmedString,
  owner: optionalTrimmedString,
  manager: optionalTrimmedString,
  deadweightTonnage: optionalPositiveInt,
  netRegisteredTonnage: optionalPositiveInt,
  lengthOverall: optionalPositiveNumber,
  breadth: optionalPositiveNumber,
  depth: optionalPositiveNumber,
  draft: optionalPositiveNumber,
  mainEngine: optionalTrimmedString,
  auxEngines: optionalTrimmedString,
  cargoCapacity: optionalPositiveNumber,
  ballastCapacity: optionalPositiveNumber,
  fuelOilCapacity: optionalPositiveNumber,
  freshWaterCapacity: optionalPositiveNumber,
  effectiveDate: isoDateField,
  notes: optionalTrimmedString,
};

/** Checkbox boolean that defaults to `true` when omitted (create forms). */
const isCurrentDefaultTrue = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return true;
  }
  if (val === true || val === false) return val;
  const s = String(val).toLowerCase();
  return s === "true" || s === "on" || s === "1" || s === "yes";
}, z.boolean());

/** Explicit boolean only when the form field is present. */
const optionalIsCurrent = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return undefined;
  }
  if (val === true || val === false) return val;
  const s = String(val).toLowerCase();
  return s === "true" || s === "on" || s === "1" || s === "yes";
}, z.boolean().optional());

export const particularsCreateSchema = z.object({
  vesselId: z.string().uuid(),
  ...particularsFields,
  isCurrent: isCurrentDefaultTrue,
});

export const particularsUpdateSchema = z.object({
  vesselId: z.string().uuid().optional(),
  ...particularsFields,
  isCurrent: optionalIsCurrent,
});

export const vesselNoteCreateSchema = z.object({
  vesselId: z.string().uuid(),
  body: z.string().trim().min(1).max(10_000),
});

export type ParticularsCreateInput = z.infer<typeof particularsCreateSchema>;
export type ParticularsUpdateInput = z.infer<typeof particularsUpdateSchema>;
export type VesselNoteCreateInput = z.infer<typeof vesselNoteCreateSchema>;
