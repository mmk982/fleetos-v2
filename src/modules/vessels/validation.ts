import { z } from "zod";
import { vesselStatusEnum } from "@/db/schema";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((s) => (s.length === 0 ? null : s))
  .nullable()
  .optional();

const optionalPositiveInt = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}, z.union([z.null(), z.number().int().positive()]).optional());

const imoField = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}, z.union([z.null(), z.number().int().min(1_000_000).max(9_999_999)]).optional());

export const vesselCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  imoNumber: imoField,
  mmsi: optionalTrimmedString,
  callSign: optionalTrimmedString,
  flagState: optionalTrimmedString,
  vesselType: optionalTrimmedString,
  grossTonnage: optionalPositiveInt,
  yearBuilt: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") {
      return null;
    }
    const n = typeof val === "number" ? val : Number(val);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }, z.union([z.null(), z.number().int().min(1800).max(2100)]).optional()),
  status: z.enum(vesselStatusEnum).default("active"),
  notes: optionalTrimmedString,
});

export const vesselUpdateSchema = vesselCreateSchema.partial().extend({
  name: z.string().trim().min(1).max(200).optional(),
});

export type VesselCreateInput = z.infer<typeof vesselCreateSchema>;
export type VesselUpdateInput = z.infer<typeof vesselUpdateSchema>;
