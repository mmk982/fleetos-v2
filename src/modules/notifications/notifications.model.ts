/**
 * Client-safe notification shapes (ISO dates) for bell / history UI.
 */
import type {
  NotificationRow,
  NotificationType,
  UserRole,
} from "@/db/schema";
import { getModuleAccess } from "@/lib/auth/permissions";

/** Roles bound to exactly one vessel (mirrors `access.ts` scoping rules). */
const VESSEL_SCOPED_ROLES: ReadonlySet<string> = new Set([
  "management_user",
  "vessel_user",
]);

/** How long a pre-cycle-key (legacy) notification still suppresses a repeat. */
export const LEGACY_SUPPRESS_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Whether an existing notification already covers a candidate.
 *
 * Same cycle (due/expiry date) → duplicate. A legacy row (`cycleKey === ""`,
 * created before cycle keys existed) keeps suppressing only for
 * {@link LEGACY_SUPPRESS_MS}, so existing alerts are not re-sent right after
 * the upgrade but a renewed certificate still notifies in its next cycle.
 */
export function isDuplicateNotification(
  existing: { cycleKey: string; createdAt: Date },
  candidateCycleKey: string,
  now: Date,
): boolean {
  if (existing.cycleKey === candidateCycleKey) return true;
  return (
    existing.cycleKey === "" &&
    now.getTime() - existing.createdAt.getTime() < LEGACY_SUPPRESS_MS
  );
}

/**
 * Whether a user may be sent a notification about `vesselId`.
 *
 * Fan-out in `syncNotifications` must apply the same visibility rules as the
 * Alerts / Reminders lists: the recipient needs `alerts` read access, and a
 * vessel-scoped role only receives items for its own vessel (fail-closed when
 * it has no vessel, or the item has no vessel).
 */
export function canReceiveNotification(
  user: { role: string | null; vesselId: string | null },
  vesselId: string | null,
): boolean {
  if (getModuleAccess(user.role as UserRole | null, "alerts") === "none") {
    return false;
  }
  if (user.role !== null && VESSEL_SCOPED_ROLES.has(user.role)) {
    return user.vesselId !== null && vesselId === user.vesselId;
  }
  return true;
}

export type NotificationListItem = {
  id: string;
  title: string;
  message: string | null;
  notificationType: NotificationType;
  isRead: boolean;
  createdAt: string;
};

export function toNotificationListItem(
  row: NotificationRow,
): NotificationListItem {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    notificationType: row.notificationType,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}
