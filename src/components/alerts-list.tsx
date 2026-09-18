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
      <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-page)] text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
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
          <tbody className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <tr
                key={`${item.kind}-${item.id}`}
                className="bg-[var(--bg-card)]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={item.href}
                    className="font-medium text-[var(--text-primary)] hover:underline"
                  >
                    {item.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {alertKindLabel(item.kind)}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  <Identifier>{item.vesselName ?? "—"}</Identifier>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {item.subjectName ?? "—"}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {item.expiresAt ?? "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-[var(--text-secondary)]">
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
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={item.href}
                className="font-medium text-[var(--text-primary)] hover:underline"
              >
                {item.title}
              </Link>
              <StatusPill status={item.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {alertKindLabel(item.kind)}
              {" · "}
              <Identifier>{item.vesselName ?? "—"}</Identifier>
              {item.subjectName ? ` · ${item.subjectName}` : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
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
