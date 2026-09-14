/**
 * Shared Zod form-field helpers — factored out of Vessels when Certificates
 * became the second module (`PROJECT_PLAN.md` Cross-cutting notes).
 *
 * FormData values arrive as strings; these coerce empties to `null` and
 * numbers/dates to typed values before reaching controllers.
 */
import { z } from "zod";

/** Empty string → `null`, otherwise trimmed. */
export const optionalTrimmedString = z
  .string()
  .trim()
  .transform((s) => (s.length === 0 ? null : s))
  .nullable()
  .optional();

/**
 * Coerces a form string to a positive integer or `null`; non-numeric input
 * fails validation rather than silently becoming `null`.
 */
export const optionalPositiveInt = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}, z.union([z.null(), z.number().int().positive()]).optional());

/**
 * Coerces a form string to a positive number or `null` (keeps decimals —
 * for LOA / capacity fields stored as Postgres `numeric`).
 */
export const optionalPositiveNumber = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : undefined;
}, z.union([z.null(), z.number().positive()]).optional());

/**
 * Optional calendar date as `YYYY-MM-DD` (or empty → `null`). Matches the
 * Postgres `date` columns and the fleet-wide storage convention (§0.4).
 */
export const isoDateField = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  if (typeof val !== "string") {
    return undefined;
  }
  const trimmed = val.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z.union([z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")]).optional());

/** Optional UUID string, empty → `null`. */
export const optionalUuid = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") {
    return null;
  }
  return val;
}, z.union([z.null(), z.string().uuid()]).optional());

/** Checkbox / select boolean from form strings (`"true"` / `"on"` / `"1"`). */
export const formBoolean = z.preprocess((val) => {
  if (val === true || val === false) {
    return val;
  }
  if (val === null || val === undefined || val === "") {
    return false;
  }
  const s = String(val).toLowerCase();
  return s === "true" || s === "on" || s === "1" || s === "yes";
}, z.boolean());
