/**
 * Monthly forms list + checklist generate + requirements admin.
 *
 * Requirements CRUD lives here until Settings / vessel-profile Executed
 * Forms tab exists (PROJECT_PLAN.md §10 placement note).
 */
"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MonthlyFormRequirementForm } from "@/components/monthly-form-requirement-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { StatusPill } from "@/components/ui/status-pill";
import {
  deleteMonthlyFormRequirementFormAction,
  generateMonthlyChecklistAction,
  type MonthlyFormActionState,
} from "@/modules/monthly-forms/actions";
import {
  monthlyFormDisplayStatusLabel,
  monthlyFormDisplayStatusTone,
  monthlyFormFrequencyLabel,
  type MonthlyFormListItem,
  type MonthlyFormRequirementListItem,
} from "@/modules/monthly-forms/monthlyForm.model";
import type { MonthlyFormDisplayStatus } from "@/modules/monthly-forms/monthly-form-status";
import type { IsmTemplateListItem } from "@/modules/ism-templates/ismTemplate.model";
import type { VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50";

type ReqDrawer =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: MonthlyFormRequirementListItem };

export function MonthlyFormsList({
  rows,
  requirements,
  vessels,
  templates,
  initialFilters,
}: {
  rows: MonthlyFormListItem[];
  requirements: MonthlyFormRequirementListItem[];
  vessels: VesselRow[];
  templates: IsmTemplateListItem[];
  initialFilters: {
    vesselId: string;
    month: string;
    year: string;
    formType: string;
    displayStatus: string;
  };
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [reqOpen, setReqOpen] = useState(true);
  const [reqDrawer, setReqDrawer] = useState<ReqDrawer>({ kind: "closed" });

  const [genState, genAction, genPending] = useActionState(
    generateMonthlyChecklistAction,
    undefined as MonthlyFormActionState | undefined,
  );

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.vesselId) params.set("vesselId", next.vesselId);
    if (next.month) params.set("month", next.month);
    if (next.year) params.set("year", next.year);
    if (next.formType) params.set("formType", next.formType);
    if (next.displayStatus) params.set("displayStatus", next.displayStatus);
    const q = params.toString();
    router.push(q ? `/dashboard/monthly-forms?${q}` : "/dashboard/monthly-forms");
  }

  const visible = useMemo(() => {
    let list = rows;
    if (filters.formType === "checklist") {
      list = list.filter((r) => r.required);
    } else if (filters.formType === "adhoc") {
      list = list.filter((r) => !r.required);
    }
    if (filters.displayStatus) {
      list = list.filter(
        (r) => r.displayStatus === (filters.displayStatus as MonthlyFormDisplayStatus),
      );
    }
    const q = searchValue.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => {
      const hay = [row.formName, row.vesselName, String(row.month), String(row.year)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filters.formType, filters.displayStatus, searchValue]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearNow = new Date().getFullYear();
  const years = [yearNow - 1, yearNow, yearNow + 1];

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
        aria-label="Month"
        className={selectClass}
        value={filters.month}
        onChange={(e) => pushFilters({ ...filters, month: e.target.value })}
      >
        <option value="">All months</option>
        {months.map((m) => (
          <option key={m} value={String(m)}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        className={selectClass}
        value={filters.year}
        onChange={(e) => pushFilters({ ...filters, year: e.target.value })}
      >
        <option value="">All years</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
      <select
        aria-label="Form type"
        className={selectClass}
        value={filters.formType}
        onChange={(e) => pushFilters({ ...filters, formType: e.target.value })}
      >
        <option value="">All types</option>
        <option value="checklist">Checklist</option>
        <option value="adhoc">Ad-hoc</option>
      </select>
      <select
        aria-label="Status"
        className={selectClass}
        value={filters.displayStatus}
        onChange={(e) =>
          pushFilters({ ...filters, displayStatus: e.target.value })
        }
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="submitted">Submitted</option>
        <option value="overdue">Overdue</option>
      </select>
    </>
  );

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filters={filterControls}
            onExport={() => {}}
            searchPlaceholder="Search form, vessel…"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={genAction} className="flex flex-wrap items-center gap-2">
            {filters.vesselId ? (
              <input type="hidden" name="vesselId" value={filters.vesselId} />
            ) : null}
            {filters.month ? (
              <input type="hidden" name="month" value={filters.month} />
            ) : null}
            {filters.year ? (
              <input type="hidden" name="year" value={filters.year} />
            ) : null}
            <button
              type="submit"
              disabled={genPending}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
            >
              {genPending ? "Generating…" : "Generate this month's checklist"}
            </button>
          </form>
          <Link
            href="/dashboard/monthly-forms/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
          >
            Add ad-hoc form
          </Link>
        </div>
      </div>

      {genState?.ok ? (
        <p
          className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200"
          role="status"
        >
          {genState.message}
        </p>
      ) : null}
      {genState && !genState.ok ? (
        <p className="text-sm text-red-600" role="alert">
          {genState.message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No executed forms match. Generate a checklist or add an ad-hoc form.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Form</th>
                <th className="px-4 py-3 font-medium">Vessel</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {visible.map((row) => (
                <tr key={row.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/monthly-forms/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {row.formName}
                    </Link>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {row.required ? "Checklist" : "Ad-hoc"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    <Identifier>{row.vesselName}</Identifier>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.month}/{row.year}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={monthlyFormDisplayStatusTone(row.displayStatus)}>
                      {monthlyFormDisplayStatusLabel(row.displayStatus)}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.attachmentCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          onClick={() => setReqOpen((o) => !o)}
          aria-expanded={reqOpen}
        >
          {/* Move to Settings / vessel profile once those exist (§10). */}
          Requirements (per vessel / template)
          <span className="font-normal text-zinc-500">
            {reqOpen ? "Hide" : "Show"}
          </span>
        </button>
        {reqOpen ? (
          <div className="space-y-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setReqDrawer({ kind: "create" })}
                className="inline-flex h-9 items-center rounded-md bg-[#378ADD] px-3 text-sm font-medium text-white"
              >
                Add requirement
              </button>
            </div>
            {requirements.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No requirements yet — checklist generation will create nothing
                until you add some.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-2 py-2 font-medium">Vessel</th>
                      <th className="px-2 py-2 font-medium">Template</th>
                      <th className="px-2 py-2 font-medium">Frequency</th>
                      <th className="px-2 py-2 font-medium">Active</th>
                      <th className="px-2 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {requirements.map((r) => (
                      <tr key={r.id}>
                        <td className="px-2 py-2">
                          <Identifier>{r.vesselName}</Identifier>
                        </td>
                        <td className="px-2 py-2">
                          <span className="font-mono text-xs">{r.formCode}</span>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {" "}
                            — {r.templateName}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {monthlyFormFrequencyLabel(r.frequency)}
                        </td>
                        <td className="px-2 py-2">
                          {r.activeStatus ? "Yes" : "No"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            className="me-3 text-sm font-medium text-[#378ADD]"
                            onClick={() => setReqDrawer({ kind: "edit", row: r })}
                          >
                            Edit
                          </button>
                          <form
                            action={deleteMonthlyFormRequirementFormAction}
                            className="inline"
                          >
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              type="submit"
                              className="text-sm font-medium text-red-700 dark:text-red-300"
                            >
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <Drawer
        open={reqDrawer.kind !== "closed"}
        onClose={() => setReqDrawer({ kind: "closed" })}
        title={
          reqDrawer.kind === "edit" ? "Edit requirement" : "Add requirement"
        }
      >
        {reqDrawer.kind === "create" ? (
          <MonthlyFormRequirementForm
            mode="create"
            vessels={vessels}
            templates={templates}
            onCancel={() => setReqDrawer({ kind: "closed" })}
          />
        ) : null}
        {reqDrawer.kind === "edit" ? (
          <MonthlyFormRequirementForm
            mode="edit"
            requirementId={reqDrawer.row.id}
            vessels={vessels}
            templates={templates}
            defaultValues={{
              vesselId: reqDrawer.row.vesselId,
              ismTemplateId: reqDrawer.row.ismTemplateId,
              frequency: reqDrawer.row.frequency,
              activeStatus: reqDrawer.row.activeStatus,
            }}
            onCancel={() => setReqDrawer({ kind: "closed" })}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
