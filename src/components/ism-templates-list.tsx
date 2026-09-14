/**
 * ISM Templates list — ListToolbar + StatusPill(tone) + Identifier + Drawer.
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IsmTemplateForm } from "@/components/ism-template-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { StatusPill } from "@/components/ui/status-pill";
import {
  ISM_TEMPLATE_STATUSES,
  ismTemplateStatusLabel,
  ismTemplateStatusTone,
  type IsmTemplateListItem,
} from "@/modules/ism-templates/ismTemplate.model";
import type { IsmTemplateCategoryRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50";

type DrawerMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: IsmTemplateListItem };

export function IsmTemplatesList({
  rows,
  categories,
  initialFilters,
}: {
  rows: IsmTemplateListItem[];
  categories: IsmTemplateCategoryRow[];
  initialFilters: { categoryId: string; status: string };
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [drawer, setDrawer] = useState<DrawerMode>({ kind: "closed" });

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.categoryId) params.set("categoryId", next.categoryId);
    if (next.status) params.set("status", next.status);
    const q = params.toString();
    router.push(q ? `/dashboard/ism-templates?${q}` : "/dashboard/ism-templates");
  }

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [row.formCode, row.formName, row.categoryName, row.revision ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, searchValue]);

  const filterControls = (
    <>
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
      <select
        aria-label="Status"
        className={selectClass}
        value={filters.status}
        onChange={(e) => pushFilters({ ...filters, status: e.target.value })}
      >
        <option value="">All statuses</option>
        {ISM_TEMPLATE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ismTemplateStatusLabel(s)}
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
            searchPlaceholder="Search code, name, category…"
          />
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ kind: "create" })}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Add template
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No templates match.{" "}
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
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {visible.map((row) => (
                  <tr key={row.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-3 font-mono text-sm">
                      <Link
                        href={`/dashboard/ism-templates/${row.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        <Identifier>{row.formCode}</Identifier>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {row.formName}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {row.categoryName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={ismTemplateStatusTone(row.status)}>
                        {ismTemplateStatusLabel(row.status)}
                      </StatusPill>
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
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/dashboard/ism-templates/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {row.formName}
                    </Link>
                    <p className="mt-1 text-sm text-zinc-500">
                      <Identifier>{row.formCode}</Identifier>
                      {` · ${row.categoryName}`}
                    </p>
                  </div>
                  <StatusPill tone={ismTemplateStatusTone(row.status)}>
                    {ismTemplateStatusLabel(row.status)}
                  </StatusPill>
                </div>
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
        title={drawer.kind === "edit" ? "Edit template" : "Add template"}
      >
        {drawer.kind === "create" ? (
          <IsmTemplateForm
            mode="create"
            categories={categories}
            onCancelHref="/dashboard/ism-templates"
          />
        ) : null}
        {drawer.kind === "edit" ? (
          <IsmTemplateForm
            mode="edit"
            templateId={drawer.row.id}
            defaultValues={drawer.row}
            categories={categories}
            onCancelHref={`/dashboard/ism-templates/${drawer.row.id}`}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
