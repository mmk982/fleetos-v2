"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
      <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No notifications yet. Visit the Dashboard to refresh the alert sweep.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.some((i) => !i.isRead) ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={markAll}
            className="text-sm font-medium text-[#378ADD] hover:underline disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>
      ) : null}

      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex flex-col gap-2 bg-white px-4 py-3 dark:bg-zinc-950 sm:flex-row sm:items-start sm:justify-between ${
              item.isRead ? "opacity-70" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {item.title}
              </p>
              {item.message ? (
                <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {item.message}
                </p>
              ) : null}
              <p className="mt-1 text-xs tabular-nums text-zinc-500">
                {item.notificationType.replaceAll("_", " ")} ·{" "}
                <time dateTime={item.createdAt}>{item.createdAt}</time>
              </p>
            </div>
            {!item.isRead ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => markOne(item.id)}
                className="shrink-0 text-sm font-medium text-[#378ADD] hover:underline disabled:opacity-50"
              >
                Mark read
              </button>
            ) : (
              <span className="shrink-0 text-xs text-zinc-400">Read</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
