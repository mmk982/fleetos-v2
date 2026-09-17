"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  markAllReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import type { NotificationListItem } from "@/modules/notifications/notifications.model";

const DROPDOWN_LIMIT = 8;

export function NotificationsBell({
  userId,
  unreadCount,
  items,
}: {
  userId: string;
  unreadCount: number;
  items: NotificationListItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  const badge =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-page)]"
      >
        <BellIcon className="h-5 w-5" />
        {badge ? (
          <span className="absolute end-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Notifications
            </p>
            {unreadCount > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={markAll}
                className="text-xs font-medium text-[#378ADD] hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--text-tertiary)]">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.slice(0, DROPDOWN_LIMIT).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={pending}
                    onClick={() => {
                      if (!item.isRead) markOne(item.id);
                    }}
                    className={`block w-full px-3 py-2.5 text-start hover:bg-[var(--bg-page)]  ${
                      item.isRead ? "opacity-70" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {item.title}
                    </p>
                    {item.message ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-tertiary)]">
                        {item.message}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] tabular-nums text-[var(--text-tertiary)]">
                      {item.createdAt.slice(0, 16).replace("T", " ")}
                      {!item.isRead ? " · Unread" : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[var(--border)] px-3 py-2">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-[#378ADD] hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
