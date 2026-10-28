/**
 * Pure time-zone helpers for "what calendar day is it for the company?".
 *
 * Why: the expiry engine and every "today" comparison work on whole calendar
 * days. Using the server's UTC date makes a certificate flip state hours late
 * (or early) for a company in, say, UTC+4. These helpers turn an IANA zone
 * (`company_profile.timezone`) into that company's calendar day.
 * Boundary: no DB, no server-only imports — safe for client and tests.
 */

/**
 * Whether `value` is an IANA time-zone id the runtime understands
 * (e.g. `Asia/Dubai`, `UTC`).
 */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The calendar day (`YYYY-MM-DD`) at `now` in `timeZone`.
 * Falls back to the UTC day when the zone is missing or invalid.
 *
 * @param timeZone - IANA zone id, or null/empty for UTC.
 * @param now - Instant to convert (defaults to the current time).
 */
export function todayInTimeZone(
  timeZone: string | null | undefined,
  now: Date = new Date(),
): string {
  if (timeZone && isValidTimeZone(timeZone)) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    const iso = `${get("year")}-${get("month")}-${get("day")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  }
  return now.toISOString().slice(0, 10);
}

/**
 * UTC-midnight `Date` for the company's current calendar day — the shape the
 * expiry engine expects for its `now` input.
 */
export function businessNowFor(
  timeZone: string | null | undefined,
  now: Date = new Date(),
): Date {
  return new Date(`${todayInTimeZone(timeZone, now)}T00:00:00.000Z`);
}
