"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  markAllReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import type { NotificationListItem } from "@/modules/notifications/notifications.model";

export function NotificationsHistory({
  userId,
  items,
}: {
  userId: string;
  items: NotificationListItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markOne(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllReadAction(userId);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
        No notifications yet. Visit the Dashboard to refresh the alert sweep.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.some((i) => !i.isRead) ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            type="button"
            disabled={pending}
            onClick={markAll}
          >
            Mark all read
          </Button>
        </div>
      ) : null}

      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex flex-col gap-2 bg-[var(--bg-card)] px-4 py-3  sm:flex-row sm:items-start sm:justify-between ${
              item.isRead ? "opacity-70" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {item.title}
              </p>
              {item.message ? (
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                  {item.message}
                </p>
              ) : null}
              <p className="mt-1 text-xs tabular-nums text-[var(--text-tertiary)]">
                {item.notificationType.replaceAll("_", " ")} ·{" "}
                <time dateTime={item.createdAt}>{item.createdAt}</time>
              </p>
            </div>
            {!item.isRead ? (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={pending}
                onClick={() => markOne(item.id)}
                className="shrink-0"
              >
                Mark read
              </Button>
            ) : (
              <span className="shrink-0 text-xs text-[var(--text-tertiary)]">Read</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
