/**
 * Manuals list — ListToolbar + Identifier + Drawer create/edit.
 */
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ManualForm } from "@/components/manual-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar, listToolbarExportLinkClass } from "@/components/ui/list-toolbar";
import { buildExportQuery } from "@/lib/export/http";
import type { ManualListItem } from "@/modules/manuals/manual.model";
import type { VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

type DrawerMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: ManualListItem };

export function ManualsList({
  rows,
  vessels,
  manualTypes,
  departments,
  initialFilters,
}: {
  rows: ManualListItem[];
  vessels: VesselRow[];
  manualTypes: string[];
  departments: string[];
  initialFilters: {
    vesselId: string;
    manualType: string;
    department: string;
  };
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [drawer, setDrawer] = useState<DrawerMode>({ kind: "closed" });

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.vesselId) params.set("vesselId", next.vesselId);
    if (next.manualType) params.set("manualType", next.manualType);
    if (next.department) params.set("department", next.department);
    const q = params.toString();
    router.push(q ? `/dashboard/manuals?${q}` : "/dashboard/manuals");
  }

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.title,
        row.vesselName,
        row.manualType ?? "",
        row.department ?? "",
        row.currentRevision?.revisionNumber ?? "",
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
        aria-label="Manual type"
        className={selectClass}
        value={filters.manualType}
        onChange={(e) =>
          pushFilters({ ...filters, manualType: e.target.value })
        }
      >
        <option value="">All types</option>
        {manualTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        aria-label="Department"
        className={selectClass}
        value={filters.department}
        onChange={(e) =>
          pushFilters({ ...filters, department: e.target.value })
        }
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
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
            exportSlot={
              <>
                <a
                  href={`/api/export/manuals?${buildExportQuery(
                    {
                      vesselId: filters.vesselId || undefined,
                      manualType: filters.manualType || undefined,
                      department: filters.department || undefined,
                    },
                    "xlsx",
                  )}`}
                  className={listToolbarExportLinkClass}
                >
                  Excel
                </a>
                <a
                  href={`/api/export/manuals?${buildExportQuery(
                    {
                      vesselId: filters.vesselId || undefined,
                      manualType: filters.manualType || undefined,
                      department: filters.department || undefined,
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
        <Button variant="primary" type="button"
          onClick={() => setDrawer({ kind: "create" })} className="shrink-0">
          Add manual
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-none border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
          No manuals match.{" "}
          <Button variant="ghost" type="button"
            onClick={() => setDrawer({ kind: "create" })} className="underline-offset-2">
            Add one
          </Button>
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
                  <th className="px-4 py-3 font-medium">Current revision</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map((row) => (
                  <tr key={row.id} className="bg-[var(--bg-card)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/manuals/${row.id}`}
                        className="font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      <Identifier>{row.vesselName}</Identifier>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.manualType ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.currentRevision ? (
                        <span>
                          {row.currentRevision.revisionNumber ?? "—"}
                          {row.currentRevision.revisionDate
                            ? ` · ${row.currentRevision.revisionDate}`
                            : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" type="button"
                        onClick={() => setDrawer({ kind: "edit", row })}>
                        Edit
                      </Button>
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
                className="rounded-none border border-[var(--border)] p-4"
              >
                <Link
                  href={`/dashboard/manuals/${row.id}`}
                  className="font-medium text-[var(--text-primary)]"
                >
                  {row.title}
                </Link>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  <Identifier>{row.vesselName}</Identifier>
                  {row.manualType ? ` · ${row.manualType}` : ""}
                </p>
                {row.currentRevision ? (
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                    Rev {row.currentRevision.revisionNumber ?? "—"}
                    {row.currentRevision.revisionDate
                      ? ` · ${row.currentRevision.revisionDate}`
                      : ""}
                  </p>
                ) : null}
                <Button variant="ghost" size="sm" type="button"
                  onClick={() => setDrawer({ kind: "edit", row })} className="mt-3">
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Drawer
        open={drawer.kind !== "closed"}
        onClose={() => setDrawer({ kind: "closed" })}
        title={drawer.kind === "edit" ? "Edit manual" : "Add manual"}
      >
        {drawer.kind === "create" ? (
          <ManualForm
            mode="create"
            vessels={vessels}
            onCancelHref="/dashboard/manuals"
          />
        ) : null}
        {drawer.kind === "edit" ? (
          <ManualForm
            mode="edit"
            manualId={drawer.row.id}
            defaultValues={drawer.row}
            vessels={vessels}
            onCancelHref={`/dashboard/manuals/${drawer.row.id}`}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
