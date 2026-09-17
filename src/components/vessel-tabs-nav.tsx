/**
 * In-page vessel detail tabs — link-based `?tab=` routing (server-friendly).
 * Visual language adapted from SettingsSubnav (underline active state).
 */
import Link from "next/link";

export const VESSEL_TABS = [
  { key: "general", label: "General Info" },
  { key: "certificates", label: "Certificates" },
  { key: "manuals", label: "Manuals" },
  { key: "ism", label: "ISM Forms" },
  { key: "executed", label: "Executed Forms" },
  { key: "drawings", label: "Drawings" },
  { key: "particulars", label: "Particulars" },
  { key: "insurance", label: "Insurance" },
  { key: "deficiencies", label: "Deficiencies" },
  { key: "notes", label: "Notes" },
] as const;

export type VesselTabKey = (typeof VESSEL_TABS)[number]["key"];

const TAB_KEYS = new Set<string>(VESSEL_TABS.map((t) => t.key));

export function parseVesselTab(raw: string | undefined): VesselTabKey {
  if (raw && TAB_KEYS.has(raw)) return raw as VesselTabKey;
  return "general";
}

export function VesselTabsNav({
  vesselId,
  active,
  /** Limit which tabs appear (used while rolling out panels). */
  keys,
}: {
  vesselId: string;
  active: VesselTabKey;
  keys?: readonly VesselTabKey[];
}) {
  const items = keys
    ? VESSEL_TABS.filter((t) => keys.includes(t.key))
    : VESSEL_TABS;

  return (
    <nav
      className="mt-6 flex flex-wrap gap-1 border-b border-[var(--border)] pb-px"
      aria-label="Vessel sections"
    >
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            href={`/dashboard/vessels/${vesselId}?tab=${item.key}`}
            className={`rounded-none px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]  "
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]  "
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
