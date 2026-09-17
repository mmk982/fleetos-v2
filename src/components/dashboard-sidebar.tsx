"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/db/schema";
import {
  getModuleAccess,
  type ModuleKey,
} from "@/lib/auth/permissions";

type NavLeaf = {
  href: string;
  label: string;
  moduleKey?: ModuleKey;
};
type NavGroup = { label: string; children: readonly NavLeaf[] };

const NAV: readonly NavGroup[] = [
  {
    label: "Overview",
    children: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    label: "Fleet",
    children: [
      { href: "/dashboard/vessels", label: "Vessels", moduleKey: "vessels" },
      { href: "/dashboard/crew", label: "Crew", moduleKey: "crew" },
      {
        href: "/dashboard/particulars",
        label: "Particulars",
        moduleKey: "particulars",
      },
    ],
  },
  {
    label: "Compliance",
    children: [
      {
        href: "/dashboard/certificates",
        label: "Certificates",
        moduleKey: "certificates",
      },
      {
        href: "/dashboard/deficiencies",
        label: "Deficiencies",
        moduleKey: "deficiencies",
      },
      {
        href: "/dashboard/insurance",
        label: "Insurance",
        moduleKey: "insurance",
      },
      { href: "/dashboard/alerts", label: "Alerts", moduleKey: "alerts" },
      { href: "/dashboard/psc", label: "PSC" },
    ],
  },
  {
    label: "Documents",
    children: [
      { href: "/dashboard/manuals", label: "Manuals", moduleKey: "manuals" },
      {
        href: "/dashboard/ism-templates",
        label: "ISM Templates",
        moduleKey: "ism_templates",
      },
      {
        href: "/dashboard/monthly-forms",
        label: "Monthly Executed Forms",
        moduleKey: "monthly_forms",
      },
      { href: "/dashboard/drawings", label: "Drawings", moduleKey: "drawings" },
      {
        href: "/dashboard/reminders",
        label: "Reminders",
        moduleKey: "reminders",
      },
    ],
  },
  {
    label: "Settings",
    children: [
      {
        href: "/dashboard/settings",
        label: "General",
        moduleKey: "settings_general",
      },
      {
        href: "/dashboard/settings/system-lists",
        label: "System Lists",
        moduleKey: "settings_general",
      },
      {
        href: "/dashboard/settings/company-profile",
        label: "Company Profile",
        moduleKey: "settings_general",
      },
      {
        href: "/dashboard/settings/users",
        label: "Users & Roles",
        moduleKey: "settings_users",
      },
    ],
  },
];

function leafIsActive(pathname: string, href: string, exact?: boolean) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  if (exact || href === "/dashboard/settings") {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function leafVisible(role: UserRole | null, leaf: NavLeaf): boolean {
  if (!leaf.moduleKey) return true;
  return getModuleAccess(role, leaf.moduleKey) !== "none";
}

function visibleNav(role: UserRole | null): NavGroup[] {
  const out: NavGroup[] = [];
  for (const group of NAV) {
    const children = group.children.filter((c) => leafVisible(role, c));
    if (children.length > 0) {
      out.push({ label: group.label, children });
    }
  }
  return out;
}

function navLinkClass(active: boolean): string {
  const base =
    "block px-4 py-2 text-sm font-medium transition-colors rounded-none";
  if (active) {
    return `${base} border-r-2 border-[#85B7EB] bg-white/[0.08] text-white dark:border-r-0 dark:border-l-2 dark:border-[var(--accent)] dark:bg-[var(--bg-card)] dark:text-[var(--text-primary)]`;
  }
  return `${base} text-[#E2E8F0] hover:bg-white/[0.06] dark:text-[var(--text-secondary)] dark:hover:bg-white/[0.04]`;
}

export function DashboardSidebar({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  const entries = visibleNav(role);

  return (
    <aside
      className="flex h-full w-[220px] shrink-0 flex-col bg-[var(--bg-sidebar)]"
      aria-label="Main navigation"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-4">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight text-white"
        >
          FleetOS
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-0 py-3">
        {entries.map((group) => (
          <div key={group.label}>
            <div className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {group.label}
            </div>
            <div className="flex flex-col">
              {group.children.map((child) => {
                const active = leafIsActive(
                  pathname,
                  child.href,
                  child.href === "/dashboard/settings",
                );
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={navLinkClass(active)}
                    aria-current={active ? "page" : undefined}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
