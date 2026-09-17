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
import { ListToolbar, listToolbarExportLinkClass } from "@/components/ui/list-toolbar";
import { buildExportQuery } from "@/lib/export/http";
import { StatusPill } from "@/components/ui/status-pill";
import {
  CERTIFICATE_AUTHORITIES,
  formatAuthority,
} from "@/modules/certificates/certificate.model";
import type { CertificateListItem } from "@/modules/certificates/certificate.model";
import type { IssuingAuthorityRow, VesselRow } from "@/db/schema";
import { STATUS_LABELS, type ComplianceStatus } from "@/lib/expiry";

const selectClass =
  "h-10 rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

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

  const exportQuery = (format: "xlsx" | "pdf") =>
    buildExportQuery(
      {
        vesselId: filters.vesselId || undefined,
        authority: filters.authority || undefined,
        issuingAuthorityId: filters.issuingAuthorityId || undefined,
        status: filters.status || undefined,
      },
      format,
    );

  return (
    <div className="mt-6 space-y-6">
      <ListToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={filterControls}
        exportSlot={
          <>
            <a
              href={`/api/export/certificates?${exportQuery("xlsx")}`}
              className={listToolbarExportLinkClass}
            >
              Excel
            </a>
            <a
              href={`/api/export/certificates?${exportQuery("pdf")}`}
              className={listToolbarExportLinkClass}
            >
              PDF
            </a>
          </>
        }
        searchPlaceholder="Search vessel, type, number…"
      />

      <div className="overflow-hidden rounded-none border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
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
              <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                <thead className="bg-[var(--bg-page)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
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
                <tbody className="divide-y divide-[var(--border)]">
                  {visible.map((row) => {
                    const dateRef =
                      row.ruleKind === "window"
                        ? (row.windowOpenDate ?? "—")
                        : (row.expiryDate ?? "—");
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-[var(--bg-page)]"
                      >
                        <td className="px-4 py-3 text-[var(--text-primary)]">
                          <Identifier>{row.vesselName}</Identifier>
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                          <Link
                            href={`/dashboard/certificates/${row.id}`}
                            className="text-[#378ADD] hover:underline"
                          >
                            {row.typeName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">
                          {row.authority}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                          <Identifier mono>{row.certificateNumber ?? "—"}</Identifier>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {row.issuingAuthorityName ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
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
                              className="text-sm font-medium text-[var(--text-secondary)] underline-offset-4 hover:underline"
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

            <ul className="divide-y divide-[var(--border)] md:hidden">
              {visible.map((row) => (
                <li key={row.id} className="relative p-4">
                  <div className="absolute end-4 top-4">
                    <StatusPill status={row.compliance.status} />
                  </div>
                  <Link
                    href={`/dashboard/certificates/${row.id}`}
                    className="block pe-24 text-sm font-medium text-[var(--text-primary)]"
                  >
                    {row.typeName}
                  </Link>
                  <dl className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <div>
                      <span className="text-[var(--text-tertiary)]">Vessel · </span>
                      <Identifier>{row.vesselName}</Identifier>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)]">Number · </span>
                      <Identifier mono>{row.certificateNumber ?? "—"}</Identifier>
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
