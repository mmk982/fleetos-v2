/**
 * Zod validation for vessel create/update input, sourced from `<form>`
 * `FormData` (all values arrive as strings or `undefined`) — every
 * preprocessor here exists to coerce that into the right type/`null`, not
 * because the underlying data is genuinely stringy.
 *
 * `PROJECT_PLAN.md`'s "Conventions" section calls out `optionalTrimmedString`
 * and `optionalPositiveInt` as helpers meant to be factored into a shared
 * util once more modules exist (Vessels currently inlines its own, as the
 * first module) — do that extraction as part of building the second module
 * (Certificates), not by editing this file in isolation.
 */
import { z } from "zod";
import { vesselStatusEnum } from "@/db/schema";

/** Empty string → `null` (so "cleared" and "never set" both store as `null`), otherwise trimmed. */
const optionalTrimmedString = z
  .string()
  .trim()
  .transform((s) => (s.length === 0 ? null : s))
  .nullable()
  .optional();

/** Coerces a form string to a positive integer or `null`; non-numeric input fails validation rather than silently becoming `null`. */
const optionalPositiveInt = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}, z.union([z.null(), z.number().int().positive()]).optional());

// 1,000,000–9,999,999: a real IMO number is always exactly 7 digits — this
// range is the validation-layer twin of formatImo()'s zero-pad in
// vessel.model.ts, not an arbitrary bound.
const imoField = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}, z.union([z.null(), z.number().int().min(1_000_000).max(9_999_999)]).optional());

/** Full vessel-creation input — every field except `name` is optional. */
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

/**
 * Partial update input. `.extend({ name: ... })` re-adds an explicit
 * (still-optional) `name` rule after `.partial()` — without it, `.partial()`
 * alone would still permit an empty-string name because the base schema's
 * `min(1)` message is preserved but not the "absent means unchanged"
 * semantics `actions.ts` relies on for partial updates.
 */
export const vesselUpdateSchema = vesselCreateSchema.partial().extend({
  name: z.string().trim().min(1).max(200).optional(),
});

/** Parsed, validated shape accepted by `createVessel` — inferred from {@link vesselCreateSchema}, not hand-maintained, so it can't drift from the runtime validation. */
export type VesselCreateInput = z.infer<typeof vesselCreateSchema>;
/** Parsed, validated shape accepted by `updateVessel` — every field optional except `name` (see {@link vesselUpdateSchema}'s `.partial().extend()` pattern). */
export type VesselUpdateInput = z.infer<typeof vesselUpdateSchema>;
