/**
 * Pure display-status derivation for Monthly Executed Forms
 * (`PROJECT_PLAN.md` §10).
 *
 * Stored `status` is only `"submitted"` | `"pending"`. `"overdue"` is never
 * written to the DB — it is computed at read time once the due month has
 * fully elapsed. No database, no `server-only` — same category as
 * `src/lib/expiry`.
 */

/** Display vocabulary for list/detail StatusPill badges. */
export type MonthlyFormDisplayStatus = "submitted" | "pending" | "overdue";

/**
 * Last calendar day of `month` in `year` at local midnight.
 *
 * Uses the standard JS trick: day `0` of the *next* month index equals the
 * last day of the target month. Callers pass a **1–12** calendar month
 * (not a 0-based JS month index).
 *
 * @param year - Full year (e.g. 2026)
 * @param month - Calendar month 1–12
 * @returns Date at local midnight on the last day of that month
 */
export function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0);
}

/**
 * Derives the UI status for a monthly executed form row.
 *
 * - `"submitted"` always wins (never overdue).
 * - `"pending"` becomes `"overdue"` once `now` is strictly after the last
 *   day of the form's `(year, month)` period; otherwise stays `"pending"`.
 *
 * @param status - Stored status (`submitted` | `pending` only)
 * @param month - Calendar month 1–12 on the executed-form row
 * @param year - Year on the executed-form row
 * @param now - Injectable clock for tests; defaults to `new Date()`
 * @returns Display status including derived `"overdue"`
 */
export function deriveMonthlyFormDisplayStatus(
  status: "submitted" | "pending",
  month: number,
  year: number,
  now: Date = new Date(),
): MonthlyFormDisplayStatus {
  if (status === "submitted") return "submitted";
  return now > lastDayOfMonth(year, month) ? "overdue" : "pending";
}
