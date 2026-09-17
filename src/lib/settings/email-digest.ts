/**
 * Typed settings accessor for the daily email digest toggle (`PROJECT_PLAN.md` §12b).
 */
import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";

export const EMAIL_DIGEST_ENABLED_KEY = "emailDigestEnabled";

/**
 * Reads whether Admin daily digests are enabled.
 * Defaults to `false` when missing or invalid.
 */
export async function getEmailDigestEnabled(): Promise<boolean> {
  const rows = await getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, EMAIL_DIGEST_ENABLED_KEY))
    .limit(1);
  const raw = rows[0]?.value;
  if (raw === undefined) return false;
  return raw === "true";
}

/**
 * Upserts `emailDigestEnabled` as `"true"` / `"false"`.
 */
export async function setEmailDigestEnabled(value: boolean): Promise<void> {
  const now = new Date();
  const asText = value ? "true" : "false";
  await getDb()
    .insert(settings)
    .values({ key: EMAIL_DIGEST_ENABLED_KEY, value: asText, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: asText, updatedAt: now },
    });
}
