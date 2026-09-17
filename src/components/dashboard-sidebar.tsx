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
type NavEntry = NavLeaf | NavGroup;

function isGroup(item: NavEntry): item is NavGroup {
  return "children" in item;
}

const NAV: readonly NavEntry[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/alerts", label: "Alerts", moduleKey: "alerts" },
  { href: "/dashboard/vessels", label: "Vessels", moduleKey: "vessels" },
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
  { href: "/dashboard/crew", label: "Crew", moduleKey: "crew" },
  {
    href: "/dashboard/insurance",
    label: "Insurance",
    moduleKey: "insurance",
  },
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
  { href: "/dashboard/manuals", label: "Manuals", moduleKey: "manuals" },
  { href: "/dashboard/drawings", label: "Drawings", moduleKey: "drawings" },
  {
    href: "/dashboard/particulars",
    label: "Particulars",
    moduleKey: "particulars",
  },
  {
    href: "/dashboard/reminders",
    label: "Reminders",
    moduleKey: "reminders",
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

function groupIsActive(pathname: string, children: readonly NavLeaf[]) {
  return children.some((c) =>
    leafIsActive(pathname, c.href, c.href === "/dashboard/settings"),
  );
}

function leafVisible(role: UserRole | null, leaf: NavLeaf): boolean {
  if (!leaf.moduleKey) return true;
  return getModuleAccess(role, leaf.moduleKey) !== "none";
}

function visibleNav(role: UserRole | null): NavEntry[] {
  const out: NavEntry[] = [];
  for (const item of NAV) {
    if (!isGroup(item)) {
      if (leafVisible(role, item)) out.push(item);
      continue;
    }
    const children = item.children.filter((c) => leafVisible(role, c));
    if (children.length > 0) {
      out.push({ label: item.label, children });
    }
  }
  return out;
}

export function DashboardSidebar({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  const entries = visibleNav(role);

  return (
    <aside
      className="flex h-full w-[240px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="Main navigation"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight text-[#0D2B45] dark:text-sky-100"
        >
          FleetOS
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {entries.map((item) => {
          if (!isGroup(item)) {
            const active = leafIsActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#0D2B45] text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          }

          const open = groupIsActive(pathname, item.children);
          return (
            <div key={item.label} className="mt-1">
              <div
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                  open
                    ? "text-[#0D2B45] dark:text-sky-200"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {item.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {item.children.map((child) => {
                  const active = leafIsActive(
                    pathname,
                    child.href,
                    child.href === "/dashboard/settings",
                  );
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`rounded-md py-1.5 pe-3 ps-5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[#0D2B45] text-white"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
