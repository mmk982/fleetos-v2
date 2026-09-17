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
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No vessels match.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Vessel</th>
                <th className="px-4 py-3 font-medium">Class society</th>
                <th className="px-4 py-3 font-medium">DWT</th>
                <th className="px-4 py-3 font-medium">LOA (m)</th>
                <th className="px-4 py-3 font-medium">Effective</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {visible.map((row) => (
                <tr key={row.vesselId} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/particulars/${row.vesselId}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      <Identifier>{row.vesselName}</Identifier>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.classSociety ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.deadweightTonnage ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.lengthOverall ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
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
