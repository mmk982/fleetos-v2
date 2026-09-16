/**
 * Client-safe notification shapes (ISO dates) for bell / history UI.
 */
import type { NotificationRow, NotificationType } from "@/db/schema";

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
