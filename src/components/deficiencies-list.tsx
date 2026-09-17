/**
 * Deficiencies list — ListToolbar + StatusPill + Identifier + Drawer add/edit.
 */
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DeficiencyForm } from "@/components/deficiency-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar, listToolbarExportLinkClass } from "@/components/ui/list-toolbar";
import { buildExportQuery } from "@/lib/export/http";
import { StatusPill } from "@/components/ui/status-pill";
import {
  DEFICIENCY_SOURCES,
  DEFICIENCY_STATUSES,
  deficiencySourceLabel,
  deficiencyStatusLabel,
  deficiencyStatusTone,
  type DeficiencyListItem,
} from "@/modules/deficiencies/deficiency.model";
import type { VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

type DrawerMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: DeficiencyListItem };

export function DeficienciesList({
  rows,
  vessels,
  initialFilters,
}: {
  rows: DeficiencyListItem[];
  vessels: VesselRow[];
  initialFilters: {
    vesselId: string;
    status: string;
    source: string;
    category: string;
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
    if (next.status) params.set("status", next.status);
    if (next.source) params.set("source", next.source);
    if (next.category) params.set("category", next.category);
    const q = params.toString();
    router.push(q ? `/dashboard/deficiencies?${q}` : "/dashboard/deficiencies");
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.category) set.add(r.category);
    }
    return [...set].sort();
  }, [rows]);

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.title,
        row.vesselName,
        row.deficiencyNumber ?? "",
        row.category ?? "",
        row.responsiblePerson ?? "",
        row.source,
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
        aria-label="Status"
        className={selectClass}
        value={filters.status}
        onChange={(e) => pushFilters({ ...filters, status: e.target.value })}
      >
        <option value="">All statuses</option>
        {DEFICIENCY_STATUSES.map((s) => (
          <option key={s} value={s}>
            {deficiencyStatusLabel(s)}
          </option>
        ))}
      </select>
      <select
        aria-label="Source"
        className={selectClass}
        value={filters.source}
        onChange={(e) => pushFilters({ ...filters, source: e.target.value })}
      >
        <option value="">All sources</option>
        {DEFICIENCY_SOURCES.map((s) => (
          <option key={s} value={s}>
            {deficiencySourceLabel(s)}
          </option>
        ))}
      </select>
      <select
        aria-label="Category"
        className={selectClass}
        value={filters.category}
        onChange={(e) => pushFilters({ ...filters, category: e.target.value })}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </>
  );

  const exportQuery = (format: "xlsx" | "pdf") =>
    buildExportQuery(
      {
        vesselId: filters.vesselId || undefined,
        status: filters.status || undefined,
        source: filters.source || undefined,
        category: filters.category || undefined,
      },
      format,
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
                  href={`/api/export/deficiencies?${exportQuery("xlsx")}`}
                  className={listToolbarExportLinkClass}
                >
                  Excel
                </a>
                <a
                  href={`/api/export/deficiencies?${exportQuery("pdf")}`}
                  className={listToolbarExportLinkClass}
                >
                  PDF
                </a>
              </>
            }
            searchPlaceholder="Search title, vessel, number…"
          />
        </div>
        <Button variant="primary" type="button"
          onClick={() => setDrawer({ kind: "create" })} className="shrink-0">
          Add deficiency
        </Button>
      </div>

      <div className="overflow-hidden rounded-none border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
            No deficiencies match.{" "}
            <Button
              variant="ghost"
              type="button"
              onClick={() => setDrawer({ kind: "create" })}
            >
              Create one
            </Button>
            .
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                <thead className="bg-[var(--bg-page)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Vessel</th>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Responsible</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {visible.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[var(--bg-page)]"
                    >
                      <td className="px-4 py-3">
                        <Identifier>{row.vesselName}</Identifier>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <Identifier mono>{row.deficiencyNumber ?? "—"}</Identifier>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/dashboard/deficiencies/${row.id}`}
                          className="text-[#378ADD] hover:underline"
                        >
                          {row.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {deficiencySourceLabel(row.source)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={deficiencyStatusTone(row.status)}>
                          {deficiencyStatusLabel(row.status)}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">{row.dueDate ?? "—"}</td>
                      <td className="px-4 py-3">
                        {row.responsiblePerson ?? "—"}
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

            <ul className="divide-y divide-[var(--border)] md:hidden">
              {visible.map((row) => (
                <li key={row.id} className="relative p-4">
                  <div className="absolute end-4 top-4">
                    <StatusPill tone={deficiencyStatusTone(row.status)}>
                      {deficiencyStatusLabel(row.status)}
                    </StatusPill>
                  </div>
                  <Link
                    href={`/dashboard/deficiencies/${row.id}`}
                    className="block pe-24 text-sm font-medium text-[var(--text-primary)]"
                  >
                    {row.title}
                  </Link>
                  <dl className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <div>
                      <span className="text-[var(--text-tertiary)]">Vessel · </span>
                      <Identifier>{row.vesselName}</Identifier>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)]">Due · </span>
                      {row.dueDate ?? "—"}
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Drawer
        open={drawer.kind !== "closed"}
        onClose={() => setDrawer({ kind: "closed" })}
        title={drawer.kind === "edit" ? "Edit deficiency" : "New deficiency"}
      >
        {drawer.kind === "create" ? (
          <DeficiencyForm
            mode="create"
            vessels={vessels}
            onCancelHref="/dashboard/deficiencies"
          />
        ) : null}
        {drawer.kind === "edit" ? (
          <DeficiencyForm
            mode="edit"
            deficiencyId={drawer.row.id}
            defaultValues={drawer.row}
            vessels={vessels}
            onCancelHref={`/dashboard/deficiencies/${drawer.row.id}`}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
