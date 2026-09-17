/**
 * GDPR access-log writer (`PROJECT_PLAN.md` §6 / Phase 4).
 *
 * Narrow scope: only Crew personal-data reads (`moduleName: "crew"`).
 * Call sites: member/certificate detail view, attachment download, and
 * Crew list export (`accessType: "export"` once per exported member).
 */
import "server-only";

import { getDb } from "@/db/client";
import {
  accessLogs,
  type AccessLogType,
} from "@/db/schema";
import { logError } from "@/lib/logging";

export type WriteAccessLogInput = {
  userId: string | null;
  /** v1: always `"crew"`. */
  moduleName: "crew";
  /** `crew_members.id` or `crew_certificates.id` (or attachment parent id). */
  recordId: string;
  accessType: AccessLogType;
};

/**
 * Appends one access-log row. Failures are logged but not thrown — a
 * logging outage must not block the user from reading their own data.
 */
export async function writeAccessLog(input: WriteAccessLogInput): Promise<void> {
  try {
    const db = getDb();
    await db.insert(accessLogs).values({
      userId: input.userId,
      moduleName: input.moduleName,
      recordId: input.recordId,
      accessType: input.accessType,
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
