/**
 * List page toolbar — search, filters, export.
 *
 * Desktop: search + filters + export in one row. Mobile: filters/export
 * collapse behind a toggle (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 5 /
 * DESIGN_HANDOFF.md §3). Token class names from Task 1 are substituted with
 * the zinc/`dark:` classes already used in Vessels/Certificates until the
 * token layer lands.
 */
"use client";

import { useState, type ReactNode } from "react";

const controlClass =
  "h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50";
const buttonClass =
  "h-10 rounded-md border border-zinc-200 bg-transparent px-4 text-sm font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400";

export function ListToolbar({
  searchValue,
  onSearchChange,
  filters,
  onExport,
  searchPlaceholder = "Search…",
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: ReactNode;
  onExport: () => void;
  searchPlaceholder?: string;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
        <div className="hidden items-center gap-2 md:flex">{filters}
          <button type="button" onClick={onExport} className={buttonClass}>
            Export
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-600 md:hidden dark:border-zinc-800 dark:text-zinc-400"
        >
          Filters
        </button>
      </div>
      {mobileFiltersOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 md:hidden dark:border-zinc-800 dark:bg-zinc-950">
          {filters}
          <button type="button" onClick={onExport} className={`h-11 ${buttonClass}`}>
            Export
          </button>
        </div>
      ) : null}
    </div>
  );
}
