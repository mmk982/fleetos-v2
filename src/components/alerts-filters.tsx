/**
 * Alerts page filter bar — URL-driven like Reminders/Deficiencies.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ALERT_KINDS,
  alertKindLabel,
  type AlertKind,
} from "@/modules/alerts/alerts.model";
import type { VesselRow } from "@/db/schema";

const selectClass =
  "h-10 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 text-sm text-[var(--text-primary)]";

/** Statuses offered in the main-list filter (actionable + clear). */
const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Actionable (default)" },
  { value: "expired", label: "Expired" },
  { value: "critical", label: "Critical" },
  { value: "expiring", label: "Expiring" },
];

export function AlertsFilters({
  vessels,
  initialFilters,
}: {
  vessels: VesselRow[];
  initialFilters: {
    vesselId: string;
    kind: string;
    status: string;
  };
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);

  function pushFilters(next: typeof filters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.vesselId) params.set("vesselId", next.vesselId);
    if (next.kind) params.set("kind", next.kind);
    if (next.status) params.set("status", next.status);
    const q = params.toString();
    router.push(q ? `/dashboard/alerts?${q}` : "/dashboard/alerts");
  }

  return (
    <div className="flex flex-wrap gap-2">
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
        aria-label="Kind"
        className={selectClass}
        value={filters.kind}
        onChange={(e) => pushFilters({ ...filters, kind: e.target.value })}
      >
        <option value="">All kinds</option>
        {ALERT_KINDS.map((k: AlertKind) => (
          <option key={k} value={k}>
            {alertKindLabel(k)}
          </option>
        ))}
      </select>
      <select
        aria-label="Status"
        className={selectClass}
        value={filters.status}
        onChange={(e) => pushFilters({ ...filters, status: e.target.value })}
      >
        {STATUS_FILTERS.map((s) => (
          <option key={s.value || "default"} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
