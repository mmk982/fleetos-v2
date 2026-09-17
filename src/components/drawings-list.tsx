/**
 * Drawings list — ListToolbar + Identifier + Drawer create/edit.
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawingForm } from "@/components/drawing-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar, listToolbarExportLinkClass } from "@/components/ui/list-toolbar";
import { buildExportQuery } from "@/lib/export/http";
import type { DrawingListItem } from "@/modules/drawings/drawing.model";
import type { DrawingCategoryRow, VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50";

type DrawerMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: DrawingListItem };

export function DrawingsList({
  rows,
  vessels,
  categories,
  initialFilters,
}: {
  rows: DrawingListItem[];
  vessels: VesselRow[];
  categories: DrawingCategoryRow[];
  initialFilters: { vesselId: string; categoryId: string };
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [drawer, setDrawer] = useState<DrawerMode>({ kind: "closed" });

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.vesselId) params.set("vesselId", next.vesselId);
    if (next.categoryId) params.set("categoryId", next.categoryId);
    const q = params.toString();
    router.push(q ? `/dashboard/drawings?${q}` : "/dashboard/drawings");
  }

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.drawingName,
        row.drawingNumber ?? "",
        row.vesselName,
        row.categoryName,
        row.revision ?? "",
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
        aria-label="Category"
        className={selectClass}
        value={filters.categoryId}
        onChange={(e) =>
          pushFilters({ ...filters, categoryId: e.target.value })
        }
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
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
                  href={`/api/export/drawings?${buildExportQuery(
                    {
                      vesselId: filters.vesselId || undefined,
                      categoryId: filters.categoryId || undefined,
                    },
                    "xlsx",
                  )}`}
                  className={listToolbarExportLinkClass}
                >
                  Excel
                </a>
                <a
                  href={`/api/export/drawings?${buildExportQuery(
                    {
                      vesselId: filters.vesselId || undefined,
                      categoryId: filters.categoryId || undefined,
                    },
                    "pdf",
                  )}`}
                  className={listToolbarExportLinkClass}
                >
                  PDF
                </a>
              </>
            }
            searchPlaceholder="Search name, number, vessel…"
          />
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ kind: "create" })}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Add drawing
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No drawings match.{" "}
          <button
            type="button"
            className="font-medium text-[#378ADD] underline-offset-2 hover:underline"
            onClick={() => setDrawer({ kind: "create" })}
          >
            Add one
          </button>
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Vessel</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Revision</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {visible.map((row) => (
                  <tr key={row.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/drawings/${row.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {row.drawingName}
                      </Link>
                      {row.drawingNumber ? (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          <Identifier>{row.drawingNumber}</Identifier>
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      <Identifier>{row.vesselName}</Identifier>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {row.categoryName}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {row.revision ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-[#378ADD] underline-offset-2 hover:underline"
                        onClick={() => setDrawer({ kind: "edit", row })}
                      >
                        Edit
                      </button>
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
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <Link
                  href={`/dashboard/drawings/${row.id}`}
                  className="font-medium text-zinc-900 dark:text-zinc-50"
                >
                  {row.drawingName}
                </Link>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  <Identifier>{row.vesselName}</Identifier>
                  {` · ${row.categoryName}`}
                </p>
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-[#378ADD]"
                  onClick={() => setDrawer({ kind: "edit", row })}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Drawer
        open={drawer.kind !== "closed"}
        onClose={() => setDrawer({ kind: "closed" })}
        title={drawer.kind === "edit" ? "Edit drawing" : "Add drawing"}
      >
        {drawer.kind === "create" ? (
          <DrawingForm
            mode="create"
            vessels={vessels}
            categories={categories}
            onCancelHref="/dashboard/drawings"
          />
        ) : null}
        {drawer.kind === "edit" ? (
          <DrawingForm
            mode="edit"
            drawingId={drawer.row.id}
            defaultValues={drawer.row}
            vessels={vessels}
            categories={categories}
            onCancelHref={`/dashboard/drawings/${drawer.row.id}`}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
