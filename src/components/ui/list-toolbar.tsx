/**
 * List page toolbar — search, filters, export.
 *
 * Desktop: search + filters + export in one row. Mobile: filters/export
 * collapse behind a toggle (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 5 /
 * DESIGN_HANDOFF.md §3).
 */
"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

const controlClass =
  "h-10 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)]";

export function ListToolbar({
  searchValue,
  onSearchChange,
  filters,
  onExport,
  exportSlot,
  searchPlaceholder = "Search…",
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: ReactNode;
  /** Legacy single Export button — ignored when {@link exportSlot} is set. */
  onExport?: () => void;
  /** Preferred: Excel/PDF links (or any custom export controls). */
  exportSlot?: ReactNode;
  searchPlaceholder?: string;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const exportControls =
    exportSlot ??
    (onExport ? (
      <Button variant="secondary" type="button" onClick={onExport}>
        Export
      </Button>
    ) : null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className={`${controlClass} w-full md:flex-1`}
        />
        <div className="hidden items-center gap-2 md:flex">
          {filters}
          {exportControls}
        </div>
        <Button
          variant="secondary"
          type="button"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          className="md:hidden"
        >
          Filters
        </Button>
      </div>
      {mobileFiltersOpen ? (
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 md:hidden">
          {filters}
          {exportControls ? (
            <div className="flex flex-wrap gap-2">{exportControls}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const listToolbarExportLinkClass =
  "inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-4 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-page)]";
