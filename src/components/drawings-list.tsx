/**
 * Drawings list — ListToolbar + Identifier + Drawer create/edit.
 */
"use client";

import { Button } from "@/components/ui/button";
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
  "h-10 rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

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
        <Button variant="primary" type="button"
          onClick={() => setDrawer({ kind: "create" })} className="shrink-0">
          Add drawing
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-none border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
          No drawings match.{" "}
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
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Vessel</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Revision</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map((row) => (
                  <tr key={row.id} className="bg-[var(--bg-card)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/drawings/${row.id}`}
                        className="font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {row.drawingName}
                      </Link>
                      {row.drawingNumber ? (
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                          <Identifier mono>{row.drawingNumber}</Identifier>
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      <Identifier>{row.vesselName}</Identifier>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.categoryName}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.revision ?? "—"}
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
                  href={`/dashboard/drawings/${row.id}`}
                  className="font-medium text-[var(--text-primary)]"
                >
                  {row.drawingName}
                </Link>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  <Identifier>{row.vesselName}</Identifier>
                  {` · ${row.categoryName}`}
                </p>
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
