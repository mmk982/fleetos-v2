/**
 * Certificates list UI — ListToolbar + StatusPill + Identifier retrofit
 * (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Tasks 3/5).
 *
 * Default view groups sub-items under their parent certificate. Search still
 * matches sub-items independently so they remain findable without expanding.
 */
"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  "h-10 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

const STATUS_FILTERS: ComplianceStatus[] = [
  "valid",
  "expiring",
  "critical",
  "expired",
  "unknown",
  "revoked",
];

function dateRef(row: CertificateListItem): string {
  return row.ruleKind === "window"
    ? (row.windowOpenDate ?? "—")
    : (row.expiryDate ?? "—");
}

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

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

  const childrenByParent = useMemo(() => {
    const map = new Map<string, CertificateListItem[]>();
    for (const row of rows) {
      if (!row.parentCertificateId) continue;
      const list = map.get(row.parentCertificateId) ?? [];
      list.push(row);
      map.set(row.parentCertificateId, list);
    }
    return map;
  }, [rows]);

  const matching = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.vesselName,
        row.typeName,
        row.certificateNumber ?? "",
        row.issuingAuthorityName ?? "",
        row.authority,
        row.parentCertificateName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, searchValue]);

  const topLevel = useMemo(() => {
    const matchingIds = new Set(matching.map((row) => row.id));
    return matching.filter((row) => {
      if (!row.parentCertificateId) return true;
      return !matchingIds.has(row.parentCertificateId);
    });
  }, [matching]);

  const searchExpandedIds = useMemo(() => {
    const ids = new Set<string>();
    const topIds = new Set(topLevel.map((row) => row.id));
    for (const row of matching) {
      if (row.parentCertificateId && topIds.has(row.parentCertificateId)) {
        ids.add(row.parentCertificateId);
      }
    }
    return ids;
  }, [matching, topLevel]);

  function isExpanded(id: string): boolean {
    return expandedIds.has(id) || searchExpandedIds.has(id);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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

  function typeCell(row: CertificateListItem, nested: boolean) {
    const childCount = row.subItemCount;
    const hasChildren = childCount > 0;
    const expanded = isExpanded(row.id);
    return (
      <div className={`flex items-center gap-2 ${nested ? "ps-6" : ""}`}>
        {hasChildren && !nested ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Collapse ${childCount} sub-items`
                : `Expand ${childCount} sub-items`
            }
            onClick={() => toggleExpanded(row.id)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--bg-page)]"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        ) : null}
        <div className="min-w-0">
          <Link
            href={`/dashboard/certificates/${row.id}`}
            className="font-medium text-[var(--accent)] hover:underline"
          >
            {row.typeName}
          </Link>
          {hasChildren && !nested ? (
            <p className="text-xs text-[var(--text-tertiary)]">
              {childCount} sub-item{childCount === 1 ? "" : "s"}
            </p>
          ) : null}
          {nested && row.parentCertificateName ? (
            <p className="text-xs text-[var(--text-tertiary)]">
              Sub-item of {row.parentCertificateName}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  function tableRow(row: CertificateListItem, nested: boolean) {
    return (
      <tr
        key={row.id}
        className={nested ? "bg-[var(--bg-page)]" : "hover:bg-[var(--bg-page)]"}
      >
        <td className="px-4 py-3 text-[var(--text-primary)]">
          <Identifier>{row.vesselName}</Identifier>
        </td>
        <td className="px-4 py-3 text-[var(--text-primary)]">{typeCell(row, nested)}</td>
        <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">
          {row.authority}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
          <Identifier mono>{row.certificateNumber ?? "—"}</Identifier>
        </td>
        <td className="px-4 py-3 text-[var(--text-secondary)]">
          {row.issuingAuthorityName ?? "—"}
        </td>
        <td className="px-4 py-3 text-[var(--text-secondary)]">{dateRef(row)}</td>
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
  }

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

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        {topLevel.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
            No certificates match.{" "}
            <Link
              href="/dashboard/certificates/new"
              className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
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
                  {topLevel.map((row) => {
                    const children = childrenByParent.get(row.id) ?? [];
                    const showChildren = isExpanded(row.id) && children.length > 0;
                    return (
                      <Fragment key={row.id}>
                        {tableRow(row, false)}
                        {showChildren
                          ? children.map((child) => tableRow(child, true))
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[var(--border)] md:hidden">
              {topLevel.map((row) => {
                const children = childrenByParent.get(row.id) ?? [];
                const showChildren = isExpanded(row.id) && children.length > 0;
                return (
                  <li key={row.id} className="p-4">
                    <div className="relative">
                      <div className="absolute end-0 top-0">
                        <StatusPill status={row.compliance.status} />
                      </div>
                      {typeCell(row, false)}
                      <dl className="mt-2 space-y-1 pe-24 text-xs text-[var(--text-secondary)]">
                        <div>
                          <span className="text-[var(--text-tertiary)]">Vessel · </span>
                          <Identifier>{row.vesselName}</Identifier>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Number · </span>
                          <Identifier mono>{row.certificateNumber ?? "—"}</Identifier>
                        </div>
                      </dl>
                    </div>
                    {showChildren ? (
                      <ul className="mt-3 space-y-2 border-s border-[var(--border)] ps-3">
                        {children.map((child) => (
                          <li key={child.id} className="flex items-start justify-between gap-2">
                            <Link
                              href={`/dashboard/certificates/${child.id}`}
                              className="text-sm text-[var(--text-primary)] hover:underline"
                            >
                              {child.typeName}
                            </Link>
                            <StatusPill status={child.compliance.status} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
