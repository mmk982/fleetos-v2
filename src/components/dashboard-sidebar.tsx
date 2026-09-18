"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  AlertTriangle,
  Anchor,
  Award,
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileStack,
  FileText,
  LayoutDashboard,
  PanelLeft,
  Settings,
  Ship,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/db/schema";
import {
  getModuleAccess,
  type ModuleKey,
} from "@/lib/auth/permissions";
import type { NavBadges } from "@/lib/nav-badges";
import { Button } from "@/components/ui/button";
import { useSidebarChrome } from "@/components/sidebar-chrome";

type NavLeaf = {
  href: string;
  label: string;
  moduleKey?: ModuleKey;
  icon: LucideIcon;
  badgeKey?: keyof NavBadges;
};

type NavGroup = { label: string; children: readonly NavLeaf[] };

const NAV: readonly NavGroup[] = [
  {
    label: "Overview",
    children: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Fleet",
    children: [
      {
        href: "/dashboard/vessels",
        label: "Vessels",
        moduleKey: "vessels",
        icon: Ship,
      },
      {
        href: "/dashboard/crew",
        label: "Crew",
        moduleKey: "crew",
        icon: Users,
        badgeKey: "crew",
      },
      {
        href: "/dashboard/particulars",
        label: "Particulars",
        moduleKey: "particulars",
        icon: ClipboardList,
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
        icon: Award,
        badgeKey: "certificates",
      },
      {
        href: "/dashboard/deficiencies",
        label: "Deficiencies",
        moduleKey: "deficiencies",
        icon: AlertTriangle,
        badgeKey: "deficiencies",
      },
      {
        href: "/dashboard/insurance",
        label: "Insurance",
        moduleKey: "insurance",
        icon: FileStack,
      },
      {
        href: "/dashboard/alerts",
        label: "Alerts",
        moduleKey: "alerts",
        icon: Bell,
      },
      { href: "/dashboard/psc", label: "PSC", icon: Anchor },
    ],
  },
  {
    label: "Documents",
    children: [
      {
        href: "/dashboard/manuals",
        label: "Manuals",
        moduleKey: "manuals",
        icon: BookOpen,
      },
      {
        href: "/dashboard/ism-templates",
        label: "ISM Templates",
        moduleKey: "ism_templates",
        icon: FileText,
      },
      {
        href: "/dashboard/monthly-forms",
        label: "Monthly Executed Forms",
        moduleKey: "monthly_forms",
        icon: FileText,
        badgeKey: "monthlyForms",
      },
      {
        href: "/dashboard/drawings",
        label: "Drawings",
        moduleKey: "drawings",
        icon: PanelLeft,
      },
      {
        href: "/dashboard/reminders",
        label: "Reminders",
        moduleKey: "reminders",
        icon: Bell,
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
        icon: Settings,
      },
      {
        href: "/dashboard/settings/system-lists",
        label: "System Lists",
        moduleKey: "settings_general",
        icon: ClipboardList,
      },
      {
        href: "/dashboard/settings/company-profile",
        label: "Company Profile",
        moduleKey: "settings_general",
        icon: Users,
      },
      {
        href: "/dashboard/settings/users",
        label: "Users & Roles",
        moduleKey: "settings_users",
        icon: Users,
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

const BADGE_TONE = {
  danger: "bg-[var(--error)]/15 text-[var(--error)]",
  warning: "bg-[var(--warning)]/15 text-[var(--warning)]",
} as const;

function NavBadge({
  count,
  tone,
  compact,
}: {
  count: number;
  tone: "danger" | "warning";
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold nums ${BADGE_TONE[tone]} ${
        compact ? "h-5 min-w-5 px-1 text-[10px]" : "h-5 min-w-5 px-1.5 text-[10px]"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function DashboardSidebar({
  role,
  badges,
}: {
  role: UserRole | null;
  badges: NavBadges;
}) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } =
    useSidebarChrome();
  const entries = visibleNav(role);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobile();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen, closeMobile]);

  const rail = (
    <aside
      className={`flex h-full flex-col border-e border-[var(--border)] bg-[var(--bg-sidebar)] transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
      aria-label="Main navigation"
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b border-[var(--border)] ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        {!collapsed ? (
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-[var(--text-primary)]"
          >
            FleetOS
          </Link>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:inline-flex"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
        {entries.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {group.label}
              </div>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {group.children.map((child) => {
                const active = leafIsActive(
                  pathname,
                  child.href,
                  child.href === "/dashboard/settings",
                );
                const Icon = child.icon;
                const badge =
                  child.badgeKey != null ? badges[child.badgeKey] : null;
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    title={collapsed ? child.label : undefined}
                    onClick={closeMobile}
                    className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--bg-page)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)]"
                    } ${collapsed ? "justify-center" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {active ? (
                      <span
                        className="absolute inset-e-0 top-1.5 bottom-1.5 w-1 rounded-full bg-[var(--accent)]"
                        aria-hidden="true"
                      />
                    ) : null}
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed ? (
                      <>
                        <span className="min-w-0 flex-1 truncate">
                          {child.label}
                        </span>
                        {badge && badge.count > 0 ? (
                          <NavBadge count={badge.count} tone={badge.tone} />
                        ) : null}
                      </>
                    ) : badge && badge.count > 0 ? (
                      <span className="absolute end-1 top-1">
                        <NavBadge
                          count={badge.count}
                          tone={badge.tone}
                          compact
                        />
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );

  return (
    <>
      {/* Desktop rail */}
      <div className="hidden shrink-0 md:block">{rail}</div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 inset-s-0 w-64 shadow-lg">
            <div className="flex h-full w-64 flex-col border-e border-[var(--border)] bg-[var(--bg-sidebar)]">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
                <Link
                  href="/dashboard"
                  className="text-lg font-semibold tracking-tight text-[var(--text-primary)]"
                  onClick={closeMobile}
                >
                  FleetOS
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeMobile}
                  aria-label="Close menu"
                >
                  ✕
                </Button>
              </div>
              <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
                {entries.map((group) => (
                  <div key={group.label}>
                    <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      {group.label}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {group.children.map((child) => {
                        const active = leafIsActive(
                          pathname,
                          child.href,
                          child.href === "/dashboard/settings",
                        );
                        const Icon = child.icon;
                        const badge =
                          child.badgeKey != null
                            ? badges[child.badgeKey]
                            : null;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={closeMobile}
                            className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                              active
                                ? "bg-[var(--bg-page)] text-[var(--accent)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)]"
                            }`}
                            aria-current={active ? "page" : undefined}
                          >
                            {active ? (
                              <span
                                className="absolute inset-e-0 top-1.5 bottom-1.5 w-1 rounded-full bg-[var(--accent)]"
                                aria-hidden="true"
                              />
                            ) : null}
                            <Icon
                              className="h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {child.label}
                            </span>
                            {badge && badge.count > 0 ? (
                              <NavBadge
                                count={badge.count}
                                tone={badge.tone}
                              />
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
