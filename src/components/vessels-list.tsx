/**
 * Vessels list UI — ListToolbar + StatusPill + Identifier retrofit
 * (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Tasks 3/5/7).
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar, listToolbarExportLinkClass } from "@/components/ui/list-toolbar";
import { buildExportQuery } from "@/lib/export/http";
import { StatusPill } from "@/components/ui/status-pill";
import {
  formatImo,
  vesselStatusTone,
  VESSEL_STATUSES,
} from "@/modules/vessels/vessel.model";
import type { VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

export function VesselsList({ vessels }: { vessels: VesselRow[] }) {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return vessels.filter((v) => {
      if (statusFilter && v.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [v.name, formatImo(v.imoNumber), v.flagState ?? "", v.vesselType ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [vessels, searchValue, statusFilter]);

  const filters = (
    <select
      aria-label="Status"
      className={selectClass}
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
    >
      <option value="">All statuses</option>
      {VESSEL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="mt-8 space-y-6">
      <ListToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={filters}
        exportSlot={
          <>
            <a
              href={`/api/export/vessels?${buildExportQuery({}, "xlsx")}`}
              className={listToolbarExportLinkClass}
            >
              Excel
            </a>
            <a
              href={`/api/export/vessels?${buildExportQuery({}, "pdf")}`}
              className={listToolbarExportLinkClass}
            >
              PDF
            </a>
          </>
        }
        searchPlaceholder="Search name, IMO, flag…"
      />

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
            No vessels match.{" "}
            <Link
              href="/dashboard/vessels/new"
              className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
            >
              Create a vessel
            </Link>
            .
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                <thead className="bg-[var(--bg-page)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">IMO</th>
                    <th className="px-4 py-3">Flag</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {visible.map((v) => (
                    <tr
                      key={v.id}
                      className="hover:bg-[var(--bg-page)]"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                        <Link
                          href={`/dashboard/vessels/${v.id}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          <Identifier>{v.name}</Identifier>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        <Identifier>{formatImo(v.imoNumber)}</Identifier>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {v.flagState ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {v.vesselType ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={vesselStatusTone(v.status)}>
                          {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/vessels/${v.id}/edit`}
                          className="text-sm font-medium text-[var(--text-secondary)] underline-offset-4 hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[var(--border)] md:hidden">
              {visible.map((v) => (
                <li key={v.id} className="relative p-4">
                  <div className="absolute end-4 top-4">
                    <StatusPill tone={vesselStatusTone(v.status)}>
                      {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                    </StatusPill>
                  </div>
                  <Link
                    href={`/dashboard/vessels/${v.id}`}
                    className="block pe-24 text-sm font-medium text-[var(--text-primary)]"
                  >
                    <Identifier>{v.name}</Identifier>
                  </Link>
                  <dl className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <div>
                      <span className="text-[var(--text-tertiary)]">IMO · </span>
                      <Identifier>{formatImo(v.imoNumber)}</Identifier>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)]">Flag · </span>
                      {v.flagState ?? "—"}
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
