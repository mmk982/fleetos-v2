"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/vessels", label: "Vessels" },
  { href: "/dashboard/certificates", label: "Certificates" },
  { href: "/dashboard/deficiencies", label: "Deficiencies" },
  { href: "/dashboard/crew", label: "Crew" },
  { href: "/dashboard/insurance", label: "Insurance" },
  { href: "/dashboard/ism-templates", label: "ISM Templates" },
  { href: "/dashboard/monthly-forms", label: "Monthly Executed Forms" },
  { href: "/dashboard/manuals", label: "Manuals" },
  { href: "/dashboard/drawings", label: "Drawings" },
  { href: "/dashboard/particulars", label: "Particulars" },
  { href: "/dashboard/reminders", label: "Reminders" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

function navItemIsActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
  const pathname = usePathname();

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
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = navItemIsActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[#0D2B45] text-white"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
