/**
 * Typed settings accessors (`PROJECT_PLAN.md` §7a).
 *
 * Callers never touch raw key/value strings — each setting gets its own
 * getter/setter. The expiry engine still accepts `criticalDays` as an
 * optional pure input; rewiring call sites is a later pass.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { DEFAULT_CRITICAL_DAYS } from "@/lib/expiry";

export const CRITICAL_DAYS_KEY = "criticalDays";

/**
 * Reads `criticalDays` from the settings table.
 * Falls back to {@link DEFAULT_CRITICAL_DAYS} when missing or invalid.
 */
export async function getCriticalDays(): Promise<number> {
  const rows = await getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, CRITICAL_DAYS_KEY))
    .limit(1);
  const raw = rows[0]?.value;
  if (raw === undefined) return DEFAULT_CRITICAL_DAYS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CRITICAL_DAYS;
  return n;
}

/**
 * Upserts `criticalDays` as a positive integer string.
 *
 * @throws when `value` is not a positive integer.
 */
export async function setCriticalDays(
  ctx: AccessContext,
  value: number,
): Promise<void> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "settings_general", "write");
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("criticalDays must be a positive integer.");
  }
  const now = new Date();
  const asText = String(value);
  await getDb()
    .insert(settings)
    .values({ key: CRITICAL_DAYS_KEY, value: asText, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: asText, updatedAt: now },
    });
}
