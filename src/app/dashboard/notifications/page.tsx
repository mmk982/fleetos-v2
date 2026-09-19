/**
 * Full notification history — linked from the top-bar bell, not the sidebar.
 * Spec: PROJECT_PLAN.md §12a.
 */
import { NotificationsHistory } from "@/components/notifications-history";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import {
  getUnreadCount,
  listNotifications,
} from "@/modules/notifications/notifications.controller";
import { toNotificationListItem } from "@/modules/notifications/notifications.model";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await requireSession();
  const access = toAccessContext(session);
  const [rows, unreadCount] = await Promise.all([
    listNotifications(access, { userId: access.userId }),
    getUnreadCount(access, access.userId),
  ]);
  const items = rows.map(toNotificationListItem);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : "All caught up."}
        </p>
      </div>

      <div className="mt-6">
        <NotificationsHistory userId={access.userId} items={items} />
      </div>
    </main>
  );
}
