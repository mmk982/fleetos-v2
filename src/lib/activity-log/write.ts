/**
 * Operational activity-log writer (Dashboard “Recent activity” feed).
 *
 * Mirrors {@link writeAccessLog}: failures are logged and swallowed so a
 * logging outage never blocks the mutation being recorded.
 *
 * Fixed vocabulary (call sites must use these exact strings):
 * - moduleName: vessel | certificate | deficiency | insurance | crew |
 *   ism_template | manual | drawing | monthly_form | particulars |
 *   reminder | user
 * - actionType: created | updated | deleted | uploaded | exported (+ closed /
 *   submitted / dismissed / completed where specified per module)
 */
import "server-only";

import { getDb } from "@/db/client";
import { activityLogs } from "@/db/schema";
import { logError } from "@/lib/logging";

export type WriteActivityLogInput = {
  userId: string | null;
  actionType: string;
  moduleName: string;
  recordId: string;
  description: string;
};

/**
 * Appends one activity-log row. Failures are logged but not thrown.
 */
export async function writeActivityLog(
  input: WriteActivityLogInput,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(activityLogs).values({
      userId: input.userId,
      actionType: input.actionType,
      moduleName: input.moduleName,
      recordId: input.recordId,
      description: input.description,
    });
  } catch (error) {
    logError("ACTIVITY_LOG_WRITE_FAILED", {
      error,
      moduleName: input.moduleName,
      recordId: input.recordId,
      actionType: input.actionType,
    });
  }
}
