/**
 * GDPR access-log writer (`PROJECT_PLAN.md` §6 / Phase 4).
 *
 * Narrow scope: only Crew personal-data reads (`moduleName: "crew"`).
 * Call sites: member/certificate detail view, attachment download, and
 * Crew list export (`accessType: "export"` once per exported member).
 *
 * Writes go through {@link withDb} so RLS on `access_logs` sees `app.user_id`.
 */
import "server-only";

import { withDb, withSavepoint } from "@/db/client";
import {
  accessLogs,
  type AccessLogType,
} from "@/db/schema";
import type { AccessContext } from "@/lib/auth/access";
import { logError } from "@/lib/logging";

export type WriteAccessLogInput = {
  /** v1: always `"crew"`. */
  moduleName: "crew";
  /** `crew_members.id` or `crew_certificates.id` (or attachment parent id). */
  recordId: string;
  accessType: AccessLogType;
};

/**
 * Appends one access-log row for the caller in `ctx`. Failures are logged
 * but not thrown — a logging outage must not block the user from reading
 * their own data.
 *
 * Nested under an outer {@link withDb}: reuses that transaction and wraps
 * the INSERT in a SAVEPOINT so a failed write cannot poison the outer tx.
 */
export async function writeAccessLog(
  ctx: AccessContext,
  input: WriteAccessLogInput,
): Promise<void> {
  try {
    await withDb(ctx, async (db) => {
      await withSavepoint("access_log_write", async () => {
        await db.insert(accessLogs).values({
          userId: ctx.userId,
          moduleName: input.moduleName,
          recordId: input.recordId,
          accessType: input.accessType,
        });
      });
    });
  } catch (error) {
    logError("ACCESS_LOG_WRITE_FAILED", {
      error,
      moduleName: input.moduleName,
      recordId: input.recordId,
      accessType: input.accessType,
    });
  }
}
