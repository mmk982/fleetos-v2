"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard/settings", label: "General", exact: true },
  { href: "/dashboard/settings/system-lists", label: "System Lists" },
  { href: "/dashboard/settings/company-profile", label: "Company Profile" },
  { href: "/dashboard/settings/users", label: "Users & Roles" },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** In-page Settings sub-nav (Form Requirements / Reports intentionally omitted). */
export function SettingsSubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="mt-4 flex flex-wrap gap-1 border-b border-[var(--border)] pb-px"
      aria-label="Settings sections"
    >
      {ITEMS.map((item) => {
        const active = isActive(
          pathname,
          item.href,
          "exact" in item ? item.exact : false,
        );
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]  "
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]  "
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
