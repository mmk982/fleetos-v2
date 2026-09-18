"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar, listToolbarExportLinkClass } from "@/components/ui/list-toolbar";
import { buildExportQuery } from "@/lib/export/http";
import type { ParticularsSummaryItem } from "@/modules/ship-particulars/particulars.model";

export function ParticularsList({ rows }: { rows: ParticularsSummaryItem[] }) {
  const [searchValue, setSearchValue] = useState("");

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.vesselName,
        row.classSociety ?? "",
        row.lengthOverall ?? "",
        row.effectiveDate ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, searchValue]);

  return (
    <div className="mt-6 space-y-6">
      <ListToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={null}
        exportSlot={
          <>
            <a
              href={`/api/export/particulars?${buildExportQuery({}, "xlsx")}`}
              className={listToolbarExportLinkClass}
            >
              Excel
            </a>
            <a
              href={`/api/export/particulars?${buildExportQuery({}, "pdf")}`}
              className={listToolbarExportLinkClass}
            >
              PDF
            </a>
          </>
        }
        searchPlaceholder="Search vessel, class society…"
      />

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
          No vessels match.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-page)] text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
              <tr>
                <th className="px-4 py-3 font-medium">Vessel</th>
                <th className="px-4 py-3 font-medium">Class society</th>
                <th className="px-4 py-3 font-medium">DWT</th>
                <th className="px-4 py-3 font-medium">LOA (m)</th>
                <th className="px-4 py-3 font-medium">Effective</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((row) => (
                <tr key={row.vesselId} className="bg-[var(--bg-card)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/particulars/${row.vesselId}`}
                      className="font-medium text-[var(--text-primary)] hover:underline"
                    >
                      <Identifier>{row.vesselName}</Identifier>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {row.classSociety ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {row.deadweightTonnage ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {row.lengthOverall ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {row.effectiveDate ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
