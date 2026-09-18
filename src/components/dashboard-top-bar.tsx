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
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { MobileNavButton } from "@/components/mobile-nav-button";
import { logoutAction } from "@/modules/auth/actions";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/** Dashboard top bar — company, date, theme, bell, avatar, sign-out. */
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
  const today = new Date().toLocaleDateString();
  const initials = initialsFromName(session.user.name ?? "");

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-card)] px-4">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNavButton />
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          {profile.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/api/company-profile/logo"
              alt=""
              className="h-8 w-auto max-w-[10rem] object-contain"
            />
          ) : null}
          <span className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
            {name}
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <NotificationsBell
          userId={access.userId}
          unreadCount={unreadCount}
          items={items}
        />
        <time
          dateTime={new Date().toISOString().slice(0, 10)}
          className="hidden text-[13px] text-[var(--text-tertiary)] sm:inline"
        >
          {today}
        </time>
        <ThemeToggle />
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-medium text-white"
          aria-hidden="true"
          title={session.user.name}
        >
          {initials}
        </span>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
