/**
 * Deficiencies list — ListToolbar + StatusPill + Identifier + Drawer add/edit.
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DeficiencyForm } from "@/components/deficiency-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar } from "@/components/ui/list-toolbar";
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
  "h-10 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50";

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

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filters={filterControls}
            onExport={() => {}}
            searchPlaceholder="Search title, vessel, number…"
          />
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ kind: "create" })}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Add deficiency
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-600 dark:text-zinc-400">
            No deficiencies match.{" "}
            <button
              type="button"
              onClick={() => setDrawer({ kind: "create" })}
              className="font-medium text-[#378ADD] underline-offset-4 hover:underline"
            >
              Create one
            </button>
            .
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
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
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {visible.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-4 py-3">
                        <Identifier>{row.vesselName}</Identifier>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <Identifier>{row.deficiencyNumber ?? "—"}</Identifier>
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
                        <button
                          type="button"
                          onClick={() => setDrawer({ kind: "edit", row })}
                          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-zinc-200 md:hidden dark:divide-zinc-800">
              {visible.map((row) => (
                <li key={row.id} className="relative p-4">
                  <div className="absolute end-4 top-4">
                    <StatusPill tone={deficiencyStatusTone(row.status)}>
                      {deficiencyStatusLabel(row.status)}
                    </StatusPill>
                  </div>
                  <Link
                    href={`/dashboard/deficiencies/${row.id}`}
                    className="block pe-24 text-sm font-medium text-zinc-900 dark:text-zinc-50"
                  >
                    {row.title}
                  </Link>
                  <dl className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <div>
                      <span className="text-zinc-500">Vessel · </span>
                      <Identifier>{row.vesselName}</Identifier>
                    </div>
                    <div>
                      <span className="text-zinc-500">Due · </span>
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
