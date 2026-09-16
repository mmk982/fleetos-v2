import Link from "next/link";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import { getCompanyProfile } from "@/modules/settings/company-profile.controller";
import {
  getUnreadCount,
  listNotifications,
} from "@/modules/notifications/notifications.controller";
import { toNotificationListItem } from "@/modules/notifications/notifications.model";
import { NotificationsBell } from "@/components/notifications-bell";

/** Dashboard top bar — company logo + name + notifications bell (§7a / §12a). */
export async function DashboardTopBar() {
  const session = await requireSession();
  const access = toAccessContext(session);
  const [profile, unreadCount, rows] = await Promise.all([
    getCompanyProfile(),
    getUnreadCount(access, access.userId),
    listNotifications(access, { userId: access.userId, limit: 8 }),
  ]);
  const name = profile.companyName?.trim() || "FleetOS";
  const items = rows.map(toNotificationListItem);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      <Link href="/dashboard" className="flex items-center gap-3">
        {profile.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/api/company-profile/logo"
            alt=""
            className="h-8 w-auto max-w-[10rem] object-contain"
          />
        ) : null}
        <span className="text-sm font-semibold tracking-tight text-[#0D2B45] dark:text-sky-100">
          {name}
        </span>
      </Link>

      <NotificationsBell
        userId={access.userId}
        unreadCount={unreadCount}
        items={items}
      />
    </header>
  );
}
