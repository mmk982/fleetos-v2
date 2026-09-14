/**
 * Reusable alerts list — full page and (later) Dashboard preview.
 * Props stay generic: `items: AlertItem[]` only.
 */
"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { Identifier } from "@/components/ui/identifier";
import {
  alertKindLabel,
  type AlertItem,
} from "@/modules/alerts/alerts.model";

export function AlertsList({
  items,
  emptyMessage = "No alerts match.",
}: {
  items: AlertItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Vessel</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Days</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item) => (
              <tr
                key={`${item.kind}-${item.id}`}
                className="bg-white dark:bg-zinc-950"
              >
                <td className="px-4 py-3">
                  <Link
                    href={item.href}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {item.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {alertKindLabel(item.kind)}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  <Identifier>{item.vesselName ?? "—"}</Identifier>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {item.subjectName ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {item.expiresAt ?? "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                  {item.daysRemaining ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {items.map((item) => (
          <li
            key={`${item.kind}-${item.id}`}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={item.href}
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {item.title}
              </Link>
              <StatusPill status={item.status} />
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {alertKindLabel(item.kind)}
              {" · "}
              <Identifier>{item.vesselName ?? "—"}</Identifier>
              {item.subjectName ? ` · ${item.subjectName}` : ""}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {item.expiresAt ?? "No date"}
              {item.daysRemaining != null
                ? ` · ${item.daysRemaining}d remaining`
                : ""}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
