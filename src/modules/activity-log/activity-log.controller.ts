/**
 * Activity-log read path (Dashboard “Recent activity”).
 *
 * Writes stay in `@/lib/activity-log/write` — this module only reads.
 */
import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activityLogs, users } from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  ForbiddenError,
  type AccessContext,
} from "@/lib/auth/access";

export type RecentActivityItem = {
  id: string;
  actionType: string;
  moduleName: string;
  recordId: string;
  description: string;
  /** Null when `userId` is null (system) or the user was deleted. */
  userName: string | null;
  createdAt: Date;
};

export type GetRecentActivityOptions = {
  limit?: number;
};

/**
 * Newest activity rows with optional actor display name.
 *
 * @param ctx - Authenticated caller.
 * @param options.limit - Max rows (default 8).
 */
export async function getRecentActivity(
  ctx: AccessContext,
  options: GetRecentActivityOptions = {},
): Promise<RecentActivityItem[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "alerts", "read");
  if (ctx.role === "management_user" || ctx.role === "vessel_user") {
    throw new ForbiddenError(
      "Recent activity is not available for vessel-scoped roles.",
    );
  }
  const limit = options.limit ?? 8;

  return getDb()
    .select({
      id: activityLogs.id,
      actionType: activityLogs.actionType,
      moduleName: activityLogs.moduleName,
      recordId: activityLogs.recordId,
      description: activityLogs.description,
      userName: users.name,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}
