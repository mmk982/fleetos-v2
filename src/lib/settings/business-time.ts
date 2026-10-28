/**
 * The company's "today" — one source for every status / due-date comparison.
 *
 * Reads `company_profile.timezone` once and caches it in-process (the setting
 * changes rarely; single-tenant deployment). `validateSession` primes the
 * cache on each authenticated request so the synchronous getters below are
 * warm wherever statuses are computed. Never primed → UTC (the old behaviour).
 * Boundary: no authorization here; it only converts an instant to a day.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companyProfile } from "@/db/schema";
import { getCriticalDays } from "@/lib/settings/critical-days";
import { businessNowFor, todayInTimeZone } from "@/lib/settings/timezone";

const CACHE_TTL_MS = 60_000;

let cachedZone: string | null = null;
let cachedCriticalDays: number | undefined;
let fetchedAt = 0;

/**
 * Refreshes the cached company time zone and `criticalDays` setting when
 * older than 60 s. Failures are swallowed — callers keep the previous value
 * (UTC / the engine default when never loaded).
 */
export async function primeBusinessTimezone(): Promise<void> {
  if (Date.now() - fetchedAt < CACHE_TTL_MS) return;
  fetchedAt = Date.now();
  try {
    const rows = await getDb()
      .select({ timezone: companyProfile.timezone })
      .from(companyProfile)
      .where(eq(companyProfile.id, 1))
      .limit(1);
    cachedZone = rows[0]?.timezone?.trim() || null;
    cachedCriticalDays = await getCriticalDays();
  } catch {
    // keep the previous values; next request retries after the TTL
  }
}

/**
 * The configured "critical" threshold in days, so every status surface (lists,
 * detail pages, alerts, dashboard) classifies critical vs expiring the same
 * way. `undefined` until first loaded → the engine's own default.
 */
export function businessCriticalDays(): number | undefined {
  return cachedCriticalDays;
}

/** Drops the cache so the next request re-reads the setting (after an edit). */
export function resetBusinessTimezoneCache(): void {
  fetchedAt = 0;
}

/** The company's current calendar day, `YYYY-MM-DD`. */
export function businessToday(): string {
  return todayInTimeZone(cachedZone);
}

/** UTC-midnight `Date` of {@link businessToday} — the expiry engine's `now`. */
export function businessNow(): Date {
  return businessNowFor(cachedZone);
}
