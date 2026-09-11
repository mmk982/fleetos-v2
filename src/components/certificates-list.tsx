/**
 * Certificates list UI — ListToolbar + StatusPill + Identifier retrofit
 * (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Tasks 3/5).
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CertificateQuickView } from "@/components/certificate-quick-view";
import { Identifier } from "@/components/ui/identifier";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { StatusPill } from "@/components/ui/status-pill";
import {
  CERTIFICATE_AUTHORITIES,
  formatAuthority,
} from "@/modules/certificates/certificate.model";
import type { CertificateListItem } from "@/modules/certificates/certificate.model";
import type { IssuingAuthorityRow, VesselRow } from "@/db/schema";
import { STATUS_LABELS, type ComplianceStatus } from "@/lib/expiry";

const selectClass =
  "h-10 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50";

const STATUS_FILTERS: ComplianceStatus[] = [
  "valid",
  "expiring",
  "critical",
  "expired",
  "unknown",
  "revoked",
];

export function CertificatesList({
  rows,
  vessels,
  issuers,
  initialFilters,
}: {
  rows: CertificateListItem[];
  vessels: VesselRow[];
  issuers: IssuingAuthorityRow[];
  initialFilters: {
    vesselId: string;
    authority: string;
    issuingAuthorityId: string;
    status: string;
  };
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState(initialFilters);

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.vesselId) params.set("vesselId", next.vesselId);
    if (next.authority) params.set("authority", next.authority);
    if (next.issuingAuthorityId) {
      params.set("issuingAuthorityId", next.issuingAuthorityId);
    }
    if (next.status) params.set("status", next.status);
    const q = params.toString();
    router.push(q ? `/dashboard/certificates?${q}` : "/dashboard/certificates");
  }

  const visible = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.vesselName,
        row.typeName,
        row.certificateNumber ?? "",
        row.issuingAuthorityName ?? "",
        row.authority,
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
        aria-label="Authority"
        className={selectClass}
        value={filters.authority}
        onChange={(e) => pushFilters({ ...filters, authority: e.target.value })}
      >
        <option value="">All authorities</option>
        {CERTIFICATE_AUTHORITIES.map((a) => (
          <option key={a} value={a}>
            {formatAuthority(a)}
          </option>
        ))}
      </select>
      <select
        aria-label="Issuing authority"
        className={selectClass}
        value={filters.issuingAuthorityId}
        onChange={(e) =>
          pushFilters({ ...filters, issuingAuthorityId: e.target.value })
        }
      >
        <option value="">All issuers</option>
        {issuers.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
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
        {STATUS_FILTERS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="mt-6 space-y-6">
      <ListToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={filterControls}
        onExport={() => {
          // Export utility is build-order step 15 — toolbar slot is wired now.
        }}
        searchPlaceholder="Search vessel, type, number…"
      />

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-600 dark:text-zinc-400">
            No certificates match.{" "}
            <Link
              href="/dashboard/certificates/new"
              className="font-medium text-[#378ADD] underline-offset-4 hover:underline"
            >
              Create one
            </Link>
            .
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Vessel</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Authority</th>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Issuer</th>
                    <th className="px-4 py-3">Expiry / window</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {visible.map((row) => {
                    const dateRef =
                      row.ruleKind === "window"
                        ? (row.windowOpenDate ?? "—")
                        : (row.expiryDate ?? "—");
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
                      >
                        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                          <Identifier>{row.vesselName}</Identifier>
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          <Link
                            href={`/dashboard/certificates/${row.id}`}
                            className="text-[#378ADD] hover:underline"
                          >
                            {row.typeName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">
                          {row.authority}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                          <Identifier>{row.certificateNumber ?? "—"}</Identifier>
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {row.issuingAuthorityName ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {dateRef}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={row.compliance.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <CertificateQuickView row={row} />
                            <Link
                              href={`/dashboard/certificates/${row.id}/edit`}
                              className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-zinc-200 md:hidden dark:divide-zinc-800">
              {visible.map((row) => (
                <li key={row.id} className="relative p-4">
                  <div className="absolute end-4 top-4">
                    <StatusPill status={row.compliance.status} />
                  </div>
                  <Link
                    href={`/dashboard/certificates/${row.id}`}
                    className="block pe-24 text-sm font-medium text-zinc-900 dark:text-zinc-50"
                  >
                    {row.typeName}
                  </Link>
                  <dl className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <div>
                      <span className="text-zinc-500">Vessel · </span>
                      <Identifier>{row.vesselName}</Identifier>
                    </div>
                    <div>
                      <span className="text-zinc-500">Number · </span>
                      <Identifier>{row.certificateNumber ?? "—"}</Identifier>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
