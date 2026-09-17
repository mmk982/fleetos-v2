/**
 * Reminders list — filters + StatusPill + inline dismiss/complete.
 * Related kind/id shown raw only (no resolve/join).
 */
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeReminderFormAction,
  deleteReminderFormAction,
  dismissReminderFormAction,
} from "@/modules/reminders/actions";
import {
  REMINDER_PRIORITIES,
  REMINDER_STATUSES,
  REMINDER_TYPES,
  reminderPriorityLabel,
  reminderPriorityTone,
  reminderStatusLabel,
  reminderStatusTone,
  reminderTypeLabel,
  type ReminderListItem,
} from "@/modules/reminders/reminder.model";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar, listToolbarExportLinkClass } from "@/components/ui/list-toolbar";
import { buildExportQuery } from "@/lib/export/http";
import { StatusPill } from "@/components/ui/status-pill";
import type { VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

const quietBtn =
  "text-sm font-medium text-[#378ADD] underline-offset-2 hover:underline disabled:opacity-50";

export function RemindersList({
  rows,
  vessels,
  initialFilters,
}: {
  rows: ReminderListItem[];
  vessels: VesselRow[];
  initialFilters: {
    vesselId: string;
    type: string;
    priority: string;
    status: string;
  };
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState(initialFilters);

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.vesselId) params.set("vesselId", next.vesselId);
    if (next.type) params.set("type", next.type);
    if (next.priority) params.set("priority", next.priority);
    if (next.status) params.set("status", next.status);
    const q = params.toString();
    router.push(q ? `/dashboard/reminders?${q}` : "/dashboard/reminders");
  }

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.title,
        row.vesselName ?? "",
        reminderTypeLabel(row.type),
        row.relatedItemKind ?? "",
        row.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, searchValue]);

  const filterControls = (
    <>
      <select
        aria-label="Vessel"
        className={selectClass}
        value={filters.vesselId}
        onChange={(e) => pushFilters({ ...filters, vesselId: e.target.value })}
      >
        <option value="">All vessels</option>
        {vessels.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Type"
        className={selectClass}
        value={filters.type}
        onChange={(e) => pushFilters({ ...filters, type: e.target.value })}
      >
        <option value="">All types</option>
        {REMINDER_TYPES.map((t) => (
          <option key={t} value={t}>
            {reminderTypeLabel(t)}
          </option>
        ))}
      </select>
      <select
        aria-label="Priority"
        className={selectClass}
        value={filters.priority}
        onChange={(e) => pushFilters({ ...filters, priority: e.target.value })}
      >
        <option value="">All priorities</option>
        {REMINDER_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {reminderPriorityLabel(p)}
          </option>
        ))}
      </select>
      <select
        aria-label="Status"
        className={selectClass}
        value={filters.status}
        onChange={(e) => pushFilters({ ...filters, status: e.target.value })}
      >
        <option value="">All statuses</option>
        {REMINDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {reminderStatusLabel(s)}
          </option>
        ))}
      </select>
    </>
  );

  function relatedLabel(row: ReminderListItem) {
    if (!row.relatedItemKind && !row.relatedItemId) return "—";
    const kind = row.relatedItemKind ?? "item";
    const id = row.relatedItemId ? ` · ${row.relatedItemId.slice(0, 8)}…` : "";
    return `${kind}${id}`;
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filters={filterControls}
            exportSlot={
              <>
                <a
                  href={`/api/export/reminders?${buildExportQuery(
                    {
                      vesselId: filters.vesselId || undefined,
                      type: filters.type || undefined,
                      priority: filters.priority || undefined,
                      status: filters.status || undefined,
                    },
                    "xlsx",
                  )}`}
                  className={listToolbarExportLinkClass}
                >
                  Excel
                </a>
                <a
                  href={`/api/export/reminders?${buildExportQuery(
                    {
                      vesselId: filters.vesselId || undefined,
                      type: filters.type || undefined,
                      priority: filters.priority || undefined,
                      status: filters.status || undefined,
                    },
                    "pdf",
                  )}`}
                  className={listToolbarExportLinkClass}
                >
                  PDF
                </a>
              </>
            }
            searchPlaceholder="Search title, vessel, type…"
          />
        </div>
        <Link
          href="/dashboard/reminders/new"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-none bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Add reminder
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-none border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
          No reminders match.{" "}
          <Link
            href="/dashboard/reminders/new"
            className="font-medium text-[#378ADD] underline-offset-2 hover:underline"
          >
            Add one
          </Link>
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-none border border-[var(--border)] md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-page)] text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Vessel</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Related</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map((row) => (
                  <tr key={row.id} className="bg-[var(--bg-card)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/reminders/${row.id}/edit`}
                        className="font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      <Identifier>{row.vesselName ?? "Fleet-wide"}</Identifier>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {reminderTypeLabel(row.type)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.reminderDate}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={reminderPriorityTone(row.priority)}>
                        {reminderPriorityLabel(row.priority)}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={reminderStatusTone(row.status)}>
                        {reminderStatusLabel(row.status)}
                      </StatusPill>
                    </td>
                    <td
                      className="max-w-[10rem] truncate px-4 py-3 text-[var(--text-tertiary)]"
                      title={
                        row.relatedItemKind || row.relatedItemId
                          ? `${row.relatedItemKind ?? ""} ${row.relatedItemId ?? ""}`.trim()
                          : undefined
                      }
                    >
                      {relatedLabel(row)}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions status={row.status} id={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {visible.map((row) => (
              <li
                key={row.id}
                className="rounded-none border border-[var(--border)] bg-[var(--bg-card)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/reminders/${row.id}/edit`}
                    className="font-medium text-[var(--text-primary)] hover:underline"
                  >
                    {row.title}
                  </Link>
                  <StatusPill tone={reminderStatusTone(row.status)}>
                    {reminderStatusLabel(row.status)}
                  </StatusPill>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  <Identifier>{row.vesselName ?? "Fleet-wide"}</Identifier>
                  {" · "}
                  {reminderTypeLabel(row.type)} · {row.reminderDate}
                </p>
                <div className="mt-3">
                  <RowActions status={row.status} id={row.id} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RowActions({
  id,
  status,
}: {
  id: string;
  status: ReminderListItem["status"];
}) {
  const pending = status === "pending";
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {pending ? (
        <>
          <form action={completeReminderFormAction}>
            <input type="hidden" name="id" value={id} />
            <Button variant="ghost" size="sm" type="submit">
              Complete
            </Button>
          </form>
          <form action={dismissReminderFormAction}>
            <input type="hidden" name="id" value={id} />
            <Button variant="ghost" size="sm" type="submit">
              Dismiss
            </Button>
          </form>
        </>
      ) : null}
      <Link href={`/dashboard/reminders/${id}/edit`} className={quietBtn}>
        Edit
      </Link>
      <form action={deleteReminderFormAction}>
        <input type="hidden" name="id" value={id} />
        <Button variant="destructive" size="sm" type="submit">
          Delete
        </Button>
      </form>
    </div>
  );
}
