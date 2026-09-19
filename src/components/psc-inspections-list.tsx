/**
 * PSC inspections list — ListToolbar + StatusPill + Drawer add/edit.
 */
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PscInspectionForm } from "@/components/psc-inspection-form";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { StatusPill } from "@/components/ui/status-pill";
import {
  PSC_INSPECTION_RESULTS,
  pscInspectionResultLabel,
  pscInspectionResultTone,
  type PscInspectionListItem,
} from "@/modules/psc/psc.model";
import type { VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

type DrawerMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: PscInspectionListItem };

export function PscInspectionsList({
  rows,
  vessels,
  canWrite,
  initialFilters,
}: {
  rows: PscInspectionListItem[];
  vessels: VesselRow[];
  canWrite: boolean;
  initialFilters: { vesselId: string; result: string };
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [drawer, setDrawer] = useState<DrawerMode>({ kind: "closed" });

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.vesselId) params.set("vesselId", next.vesselId);
    if (next.result) params.set("result", next.result);
    const q = params.toString();
    router.push(q ? `/dashboard/psc?${q}` : "/dashboard/psc");
  }

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.vesselName,
        row.port,
        row.authority,
        row.inspectorName ?? "",
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
        aria-label="Result"
        className={selectClass}
        value={filters.result}
        onChange={(e) => pushFilters({ ...filters, result: e.target.value })}
      >
        <option value="">All results</option>
        {PSC_INSPECTION_RESULTS.map((r) => (
          <option key={r} value={r}>
            {pscInspectionResultLabel(r)}
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
            searchPlaceholder="Search port, authority, vessel…"
          />
        </div>
        {canWrite ? (
          <Button
            variant="primary"
            type="button"
            onClick={() => setDrawer({ kind: "create" })}
            className="shrink-0"
          >
            New Inspection
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
            No PSC inspections match.
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
                    <th className="px-4 py-3">Port</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Authority</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Detained</th>
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
                          href={`/dashboard/psc/${row.id}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {row.port}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{row.inspectionDate}</td>
                      <td className="px-4 py-3">{row.authority}</td>
                      <td className="px-4 py-3">
                        <StatusPill
                          tone={pscInspectionResultTone(row.result, row.detained)}
                          dot
                        >
                          {pscInspectionResultLabel(row.result)}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        {row.detained ? (
                          <StatusPill tone="danger" dot>
                            Detained
                          </StatusPill>
                        ) : (
                          "—"
                        )}
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
                  <div className="absolute end-4 top-4">
                    <StatusPill
                      tone={pscInspectionResultTone(row.result, row.detained)}
                      dot
                    >
                      {pscInspectionResultLabel(row.result)}
                    </StatusPill>
                  </div>
                  <Link
                    href={`/dashboard/psc/${row.id}`}
                    className="block pe-28 text-sm font-medium text-[var(--text-primary)]"
                  >
                    {row.port}
                  </Link>
                  <dl className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <div>
                      <span className="text-[var(--text-tertiary)]">Vessel · </span>
                      <Identifier>{row.vesselName}</Identifier>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)]">Date · </span>
                      {row.inspectionDate}
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
          title={
            drawer.kind === "edit" ? "Edit inspection" : "New PSC inspection"
          }
        >
          {drawer.kind === "create" ? (
            <PscInspectionForm
              mode="create"
              vessels={vessels}
              onCancelHref="/dashboard/psc"
            />
          ) : null}
          {drawer.kind === "edit" ? (
            <PscInspectionForm
              mode="edit"
              inspectionId={drawer.row.id}
              defaultValues={drawer.row}
              vessels={vessels}
              onCancelHref={`/dashboard/psc/${drawer.row.id}`}
            />
          ) : null}
        </Drawer>
      ) : null}
    </div>
  );
}
