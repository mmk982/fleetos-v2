/**
 * ISM Templates list — ListToolbar + StatusPill(tone) + Identifier + Drawer.
 */
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IsmTemplateForm } from "@/components/ism-template-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar, listToolbarExportLinkClass } from "@/components/ui/list-toolbar";
import { buildExportQuery } from "@/lib/export/http";
import { StatusPill } from "@/components/ui/status-pill";
import {
  ISM_TEMPLATE_STATUSES,
  ismTemplateStatusLabel,
  ismTemplateStatusTone,
  type IsmTemplateListItem,
} from "@/modules/ism-templates/ismTemplate.model";
import type { IsmTemplateCategoryRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

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
            exportSlot={
              <>
                <a
                  href={`/api/export/ism-templates?${buildExportQuery(
                    {
                      categoryId: filters.categoryId || undefined,
                      status: filters.status || undefined,
                    },
                    "xlsx",
                  )}`}
                  className={listToolbarExportLinkClass}
                >
                  Excel
                </a>
                <a
                  href={`/api/export/ism-templates?${buildExportQuery(
                    {
                      categoryId: filters.categoryId || undefined,
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
            searchPlaceholder="Search code, name, category…"
          />
        </div>
        <Button variant="primary" type="button"
          onClick={() => setDrawer({ kind: "create" })} className="shrink-0">
          Add template
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-none border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
          No templates match.{" "}
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
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map((row) => (
                  <tr key={row.id} className="bg-[var(--bg-card)]">
                    <td className="px-4 py-3 font-mono text-sm">
                      <Link
                        href={`/dashboard/ism-templates/${row.id}`}
                        className="font-medium text-[var(--text-primary)] hover:underline"
                      >
                        <Identifier mono>{row.formCode}</Identifier>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {row.formName}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.categoryName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={ismTemplateStatusTone(row.status)}>
                        {ismTemplateStatusLabel(row.status)}
                      </StatusPill>
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
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/dashboard/ism-templates/${row.id}`}
                      className="font-medium text-[var(--text-primary)] hover:underline"
                    >
                      {row.formName}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                      <Identifier mono>{row.formCode}</Identifier>
                      {` · ${row.categoryName}`}
                    </p>
                  </div>
                  <StatusPill tone={ismTemplateStatusTone(row.status)}>
                    {ismTemplateStatusLabel(row.status)}
                  </StatusPill>
                </div>
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
