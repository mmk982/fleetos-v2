/**
 * Insurance list — ListToolbar + StatusPill(compliance) + Identifier + Drawer.
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InsuranceForm } from "@/components/insurance-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar, listToolbarExportLinkClass } from "@/components/ui/list-toolbar";
import { buildExportQuery } from "@/lib/export/http";
import { StatusPill } from "@/components/ui/status-pill";
import {
  INSURANCE_TYPES,
  insuranceTypeLabel,
  type InsuranceListItem,
} from "@/modules/insurance/insurance.model";
import type { VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

type DrawerMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: InsuranceListItem };

export function InsuranceList({
  rows,
  vessels,
  initialFilters,
}: {
  rows: InsuranceListItem[];
  vessels: VesselRow[];
  initialFilters: { vesselId: string; policyType: string };
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [drawer, setDrawer] = useState<DrawerMode>({ kind: "closed" });

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.vesselId) params.set("vesselId", next.vesselId);
    if (next.policyType) params.set("policyType", next.policyType);
    const q = params.toString();
    router.push(q ? `/dashboard/insurance?${q}` : "/dashboard/insurance");
  }

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.vesselName,
        insuranceTypeLabel(row.policyType),
        row.provider ?? "",
        row.policyNumber ?? "",
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
        aria-label="Policy type"
        className={selectClass}
        value={filters.policyType}
        onChange={(e) =>
          pushFilters({ ...filters, policyType: e.target.value })
        }
      >
        <option value="">All types</option>
        {INSURANCE_TYPES.map((t) => (
          <option key={t} value={t}>
            {insuranceTypeLabel(t)}
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
                  href={`/api/export/insurance?${buildExportQuery(
                    {
                      vesselId: filters.vesselId || undefined,
                      policyType: filters.policyType || undefined,
                    },
                    "xlsx",
                  )}`}
                  className={listToolbarExportLinkClass}
                >
                  Excel
                </a>
                <a
                  href={`/api/export/insurance?${buildExportQuery(
                    {
                      vesselId: filters.vesselId || undefined,
                      policyType: filters.policyType || undefined,
                    },
                    "pdf",
                  )}`}
                  className={listToolbarExportLinkClass}
                >
                  PDF
                </a>
              </>
            }
            searchPlaceholder="Search vessel, provider, policy…"
          />
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ kind: "create" })}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Add policy
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
          No policies match.{" "}
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
          <div className="hidden overflow-x-auto rounded-lg border border-[var(--border)] md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-page)] text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Vessel</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map((row) => (
                  <tr key={row.id} className="bg-[var(--bg-card)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/insurance/${row.id}`}
                        className="font-medium text-[var(--text-primary)] hover:underline"
                      >
                        <Identifier>{row.vesselName}</Identifier>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {insuranceTypeLabel(row.policyType)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.provider ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {row.expiryDate ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.compliance.status} />
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
                className="rounded-lg border border-[var(--border)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/dashboard/insurance/${row.id}`}
                      className="font-medium text-[var(--text-primary)] hover:underline"
                    >
                      {insuranceTypeLabel(row.policyType)}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                      <Identifier>{row.vesselName}</Identifier>
                      {row.expiryDate ? ` · ${row.expiryDate}` : ""}
                    </p>
                  </div>
                  <StatusPill status={row.compliance.status} />
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
        title={drawer.kind === "edit" ? "Edit policy" : "Add policy"}
      >
        {drawer.kind === "create" ? (
          <InsuranceForm
            mode="create"
            vessels={vessels}
            onCancelHref="/dashboard/insurance"
          />
        ) : null}
        {drawer.kind === "edit" ? (
          <InsuranceForm
            mode="edit"
            policyId={drawer.row.id}
            defaultValues={drawer.row}
            vessels={vessels}
            onCancelHref={`/dashboard/insurance/${drawer.row.id}`}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
