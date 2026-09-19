/**
 * Audits list — ListToolbar + Drawer add/edit (mirrors PSC list).
 */
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuditForm } from "@/components/audit-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar } from "@/components/ui/list-toolbar";
import {
  AUDIT_TYPES,
  auditTypeLabel,
  type AuditListItem,
} from "@/modules/audits/audit.model";
import type { VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

type DrawerMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: AuditListItem };

function truncateNotes(notes: string | null, max = 60): string {
  if (!notes) return "—";
  if (notes.length <= max) return notes;
  return `${notes.slice(0, max)}…`;
}

export function AuditsList({
  rows,
  vessels,
  canWrite,
  initialFilters,
}: {
  rows: AuditListItem[];
  vessels: VesselRow[];
  canWrite: boolean;
  initialFilters: { vesselId: string; auditType: string };
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [drawer, setDrawer] = useState<DrawerMode>({ kind: "closed" });

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.vesselId) params.set("vesselId", next.vesselId);
    if (next.auditType) params.set("auditType", next.auditType);
    const q = params.toString();
    router.push(q ? `/dashboard/audits?${q}` : "/dashboard/audits");
  }

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.vesselName,
        row.auditType,
        row.auditor ?? "",
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
        aria-label="Audit type"
        className={selectClass}
        value={filters.auditType}
        onChange={(e) =>
          pushFilters({ ...filters, auditType: e.target.value })
        }
      >
        <option value="">All types</option>
        {AUDIT_TYPES.map((t) => (
          <option key={t} value={t}>
            {auditTypeLabel(t)}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filters={filterControls}
            searchPlaceholder="Search vessel, type, auditor…"
          />
        </div>
        {canWrite ? (
          <Button
            variant="primary"
            type="button"
            onClick={() => setDrawer({ kind: "create" })}
            className="shrink-0"
          >
            New Audit
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
            No audits match.
            {canWrite ? (
              <>
                {" "}
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setDrawer({ kind: "create" })}
                >
                  Create one
                </Button>
                .
              </>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                <thead className="bg-[var(--bg-page)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Vessel</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Auditor</th>
                    <th className="px-4 py-3">Findings</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {visible.map((row) => (
                    <tr key={row.id} className="hover:bg-[var(--bg-page)]">
                      <td className="px-4 py-3">
                        <Identifier>{row.vesselName}</Identifier>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/dashboard/audits/${row.id}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {auditTypeLabel(row.auditType)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{row.auditDate}</td>
                      <td className="px-4 py-3">{row.auditor ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            row.findingsCount > 0
                              ? "font-medium text-[var(--warning)]"
                              : undefined
                          }
                        >
                          {row.findingsCount}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-[var(--text-secondary)]">
                        {truncateNotes(row.notes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => setDrawer({ kind: "edit", row })}
                          >
                            Edit
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[var(--border)] md:hidden">
              {visible.map((row) => (
                <li key={row.id} className="relative p-4">
                  <div className="absolute end-4 top-4 text-xs font-medium text-[var(--text-secondary)]">
                    <span
                      className={
                        row.findingsCount > 0
                          ? "text-[var(--warning)]"
                          : undefined
                      }
                    >
                      {row.findingsCount} findings
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/audits/${row.id}`}
                    className="block pe-28 text-sm font-medium text-[var(--text-primary)]"
                  >
                    {auditTypeLabel(row.auditType)}
                  </Link>
                  <dl className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <div>
                      <span className="text-[var(--text-tertiary)]">Vessel · </span>
                      <Identifier>{row.vesselName}</Identifier>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)]">Date · </span>
                      {row.auditDate}
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {canWrite ? (
        <Drawer
          open={drawer.kind !== "closed"}
          onClose={() => setDrawer({ kind: "closed" })}
          title={drawer.kind === "edit" ? "Edit audit" : "New audit"}
        >
          {drawer.kind === "create" ? (
            <AuditForm
              mode="create"
              vessels={vessels}
              onCancelHref="/dashboard/audits"
            />
          ) : null}
          {drawer.kind === "edit" ? (
            <AuditForm
              mode="edit"
              auditId={drawer.row.id}
              defaultValues={drawer.row}
              vessels={vessels}
              onCancelHref={`/dashboard/audits/${drawer.row.id}`}
            />
          ) : null}
        </Drawer>
      ) : null}
    </div>
  );
}
