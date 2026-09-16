/**
 * Notifications data-access — lazy sync from Alerts + due Reminders,
 * list/unread, mark-read. Spec: PROJECT_PLAN.md §12a.
 */
import "server-only";

import { and, count, desc, eq, inArray, lte, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  notifications,
  reminders,
  users,
  type NotificationRow,
  type NotificationType,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  ForbiddenError,
  type AccessContext,
} from "@/lib/auth/access";
import { logError } from "@/lib/logging";
import { getAlerts } from "@/modules/alerts/alerts.controller";
import type { AlertItem } from "@/modules/alerts/alerts.model";

export class NotificationNotFoundError extends Error {
  readonly code = "NOTIFICATION_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Notification not found: ${id}`);
    this.name = "NotificationNotFoundError";
  }
}

export type ListNotificationsFilters = {
  userId: string;
  isRead?: boolean;
  limit?: number;
};

type SyncCandidate = {
  recordId: string;
  vesselId: string | null;
  notificationType: NotificationType;
  title: string;
  message: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dedupeKey(
  userId: string,
  recordId: string,
  notificationType: NotificationType,
): string {
  return `${userId}|${recordId}|${notificationType}`;
}

/** Map an actionable alert to a notification type (spec mapping). */
export function notificationTypeFromAlert(
  alert: AlertItem,
): NotificationType | null {
  switch (alert.kind) {
    case "certificate":
      return alert.status === "expired"
        ? "certificate_expired"
        : "certificate_due";
    case "crew_certificate":
      return "crew_certificate_due";
    case "insurance":
      return "insurance_due";
    case "deficiency":
      return "deficiency_update";
    default:
      return null;
  }
}

function messageFromAlert(alert: AlertItem): string {
  const vessel = alert.vesselName ? ` on ${alert.vesselName}` : "";
  if (alert.status === "expired") {
    return `${alert.title}${vessel} has expired.`;
  }
  if (alert.daysRemaining != null) {
    return `${alert.title}${vessel} is due in ${alert.daysRemaining} day(s).`;
  }
  return `${alert.title}${vessel} needs attention.`;
}

function titleFromAlert(alert: AlertItem): string {
  if (alert.vesselName) return `${alert.title} — ${alert.vesselName}`;
  return alert.title;
}

/**
 * Lazy notification sweep: actionable alerts + due pending reminders,
 * fan-out to every active user, deduped on (userId, recordId, type).
 * Failures are logged and swallowed (same spirit as writeActivityLog).
 */
export async function syncNotifications(ctx: AccessContext): Promise<void> {
  try {
    assertAuthenticatedAccess(ctx);
    const db = getDb();

    const [alerts, activeUsers, dueReminders] = await Promise.all([
      getAlerts(ctx),
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isActive, true)),
      db
        .select({
          id: reminders.id,
          title: reminders.title,
          vesselId: reminders.vesselId,
          reminderDate: reminders.reminderDate,
        })
        .from(reminders)
        .where(
          and(
            eq(reminders.status, "pending"),
            lte(reminders.reminderDate, todayIsoDate()),
          ),
        ),
    ]);

    if (activeUsers.length === 0) return;

    const candidates: SyncCandidate[] = [];

    for (const alert of alerts) {
      const notificationType = notificationTypeFromAlert(alert);
      if (!notificationType) continue;
      candidates.push({
        recordId: alert.id,
        vesselId: alert.vesselId,
        notificationType,
        title: titleFromAlert(alert),
        message: messageFromAlert(alert),
      });
    }

    for (const reminder of dueReminders) {
      candidates.push({
        recordId: reminder.id,
        vesselId: reminder.vesselId,
        notificationType: "reminder",
        title: reminder.title,
        message: `Reminder due ${reminder.reminderDate}.`,
      });
    }

    if (candidates.length === 0) return;

    const recordIds = [...new Set(candidates.map((c) => c.recordId))];
    const existing = await db
      .select({
        userId: notifications.userId,
        recordId: notifications.recordId,
        notificationType: notifications.notificationType,
      })
      .from(notifications)
      .where(inArray(notifications.recordId, recordIds));

    const seen = new Set<string>();
    for (const row of existing) {
      if (!row.userId || !row.recordId) continue;
      seen.add(dedupeKey(row.userId, row.recordId, row.notificationType));
    }

    const toInsert: {
      userId: string;
      vesselId: string | null;
      recordId: string;
      title: string;
      message: string;
      notificationType: NotificationType;
    }[] = [];

    for (const user of activeUsers) {
      for (const candidate of candidates) {
        const key = dedupeKey(
          user.id,
          candidate.recordId,
          candidate.notificationType,
        );
        if (seen.has(key)) continue;
        seen.add(key);
        toInsert.push({
          userId: user.id,
          vesselId: candidate.vesselId,
          recordId: candidate.recordId,
          title: candidate.title,
          message: candidate.message,
          notificationType: candidate.notificationType,
        });
      }
    }

    if (toInsert.length === 0) return;

    // Chunk inserts to keep payload sizes reasonable.
    const CHUNK = 200;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await db.insert(notifications).values(toInsert.slice(i, i + CHUNK));
    }
  } catch (error) {
    logError("NOTIFICATION_SYNC_FAILED", { error });
  }
}

export async function listNotifications(
  ctx: AccessContext,
  filters: ListNotificationsFilters,
): Promise<NotificationRow[]> {
  assertAuthenticatedAccess(ctx);
  assertOwnUser(ctx, filters.userId);

  const conditions: SQL[] = [eq(notifications.userId, filters.userId)];
  if (filters.isRead !== undefined) {
    conditions.push(eq(notifications.isRead, filters.isRead));
  }

  const query = getDb()
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt));

  if (filters.limit != null && filters.limit >= 0) {
    return query.limit(filters.limit);
  }
  return query;
}

export async function getUnreadCount(
  ctx: AccessContext,
  userId: string,
): Promise<number> {
  assertAuthenticatedAccess(ctx);
  assertOwnUser(ctx, userId);

  const rows = await getDb()
    .select({ n: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    );
  return rows[0]?.n ?? 0;
}

export async function markNotificationRead(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx);
  const updated = await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, ctx.userId)),
    )
    .returning({ id: notifications.id });
  if (updated.length === 0) throw new NotificationNotFoundError(id);
}

export async function markAllNotificationsRead(
  ctx: AccessContext,
  userId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx);
  assertOwnUser(ctx, userId);
  await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    );
}

function assertOwnUser(ctx: AccessContext, userId: string): void {
  if (ctx.userId !== userId) {
    throw new ForbiddenError("Cannot access another user's notifications.");
  }
}
