/**
 * Fleet health dashboard — summary cards, alert previews, recent activity.
 * Spec: PROJECT_PLAN.md §6.
 */
import Link from "next/link";
import {
  Anchor,
  AlertCircle,
  AlertTriangle,
  Award,
  Clock,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { AlertsList } from "@/components/alerts-list";
import { StatusPill } from "@/components/ui/status-pill";
import { Identifier } from "@/components/ui/identifier";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import {
  STATUS_LABELS,
  type ComplianceStatus,
} from "@/lib/expiry";
import { getRecentActivity } from "@/modules/activity-log/activity-log.controller";
import { getAlerts } from "@/modules/alerts/alerts.controller";
import {
  alertKindLabel,
  type AlertKind,
} from "@/modules/alerts/alerts.model";
import { getOpenDeficienciesCount } from "@/modules/deficiencies/deficiency.controller";
import { getManualCount } from "@/modules/manuals/manual.controller";
import { listMonthlyForms } from "@/modules/monthly-forms/monthlyForm.controller";
import {
  monthlyFormDisplayStatusLabel,
  monthlyFormDisplayStatusTone,
  type MonthlyFormListItem,
} from "@/modules/monthly-forms/monthlyForm.model";
import { syncNotifications } from "@/modules/notifications/notifications.controller";
import { getCompanyProfile } from "@/modules/settings/company-profile.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";

export const dynamic = "force-dynamic";

const PREVIEW_LIMIT = 6;
const ACTIVITY_LIMIT = 8;

const CERT_COUNT_STATUSES: ComplianceStatus[] = [
  "valid",
  "expiring",
  "critical",
  "expired",
];

export default async function DashboardPage() {
  const session = await requireSession();
  const access = toAccessContext(session);
  const skipRecentActivity =
    access.role === "management_user" || access.role === "vessel_user";

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [
    healthAlerts,
    certificateStatuses,
    certificatesDueSoon,
    openDeficiencyAlerts,
    missingMonthlyForms,
    vesselCount,
    openDeficienciesCount,
    manualCount,
    recentActivity,
    profile,
  ] = await Promise.all([
    getAlerts(access),
    getAlerts(access, {
      kinds: ["certificate"],
      statuses: CERT_COUNT_STATUSES,
    }),
    getAlerts(access, { kinds: ["certificate"], limit: PREVIEW_LIMIT }),
    getAlerts(access, { kinds: ["deficiency"], limit: PREVIEW_LIMIT }),
    listMonthlyForms(access, { month, year, status: "pending" }),
    listSelectableVessels(access).then((v) => v.length),
    getOpenDeficienciesCount(access),
    getManualCount(access),
    skipRecentActivity
      ? Promise.resolve([])
      : getRecentActivity(access, { limit: ACTIVITY_LIMIT }),
    getCompanyProfile(),
    // Lazy notification sweep — runs in parallel; errors are logged inside.
    syncNotifications(access),
  ]);

  const companyLabel = profile.companyName?.trim() || "FleetOS";

  let validCertificates = 0;
  let dueSoonCertificates = 0;
  let expiredCertificates = 0;
  for (const item of certificateStatuses) {
    if (item.status === "valid") validCertificates += 1;
    else if (item.status === "expiring" || item.status === "critical") {
      dueSoonCertificates += 1;
    } else if (item.status === "expired") expiredCertificates += 1;
  }

  const healthByStatus = countBy(
    healthAlerts,
    (a) => a.status,
    ["expired", "critical", "expiring"] as const,
  );
  const healthByKind = countBy(
    healthAlerts,
    (a) => a.kind,
    ["certificate", "crew_certificate", "insurance", "deficiency"] as const,
  );

  const stats: {
    label: string;
    value: number;
    href?: string;
    icon: LucideIcon;
    tone: "green" | "amber" | "red" | "blue" | "orange" | "slate";
    valueTone?: "green" | "amber" | "red" | "blue" | "orange" | "slate";
  }[] = [
    {
      label: "Vessels",
      value: vesselCount,
      href: "/dashboard/vessels",
      icon: Anchor,
      tone: "slate",
    },
    {
      label: "Valid certs",
      value: validCertificates,
      href: "/dashboard/certificates",
      icon: Award,
      tone: "green",
    },
    {
      label: "Expired certs",
      value: expiredCertificates,
      href: "/dashboard/alerts?kind=certificate&status=expired",
      icon: AlertCircle,
      tone: "red",
    },
    {
      label: "Open defs",
      value: openDeficienciesCount,
      href: "/dashboard/deficiencies",
      icon: AlertTriangle,
      tone: "orange",
      valueTone: "red",
    },
    {
      label: "Due certs",
      value: dueSoonCertificates,
      href: "/dashboard/alerts?kind=certificate",
      icon: Clock,
      tone: "amber",
    },
    {
      label: "Pending forms",
      value: missingMonthlyForms.length,
      href: "/dashboard/monthly-forms",
      icon: FileText,
      tone: "slate",
    },
    {
      label: "Manuals",
      value: manualCount,
      href: "/dashboard/manuals",
      icon: FileText,
      tone: "slate",
    },
  ];

  const TONE = {
    green: {
      label: "text-[var(--success)]",
      iconBg: "bg-[color-mix(in_oklab,var(--success)_12%,white)] dark:bg-[var(--success)]/20",
      icon: "text-[var(--success)]",
      hoverBorder: "hover:border-[var(--success)]",
      value: "text-[var(--success)]",
    },
    amber: {
      label: "text-[var(--warning)]",
      iconBg: "bg-[color-mix(in_oklab,var(--warning)_12%,white)] dark:bg-[var(--warning)]/20",
      icon: "text-[var(--warning)]",
      hoverBorder: "hover:border-[var(--warning)]",
      value: "text-[var(--warning)]",
    },
    red: {
      label: "text-[var(--error)]",
      iconBg: "bg-[color-mix(in_oklab,var(--error)_12%,white)] dark:bg-[var(--error)]/20",
      icon: "text-[var(--error)]",
      hoverBorder: "hover:border-[var(--error)]",
      value: "text-[var(--error)]",
    },
    blue: {
      label: "text-[var(--tone-blue-fg)]",
      iconBg: "bg-[var(--tone-blue-bg)]",
      icon: "text-[var(--tone-blue-fg)]",
      hoverBorder: "hover:border-[var(--tone-blue-fg)]",
      value: "text-[var(--tone-blue-fg)]",
    },
    orange: {
      label: "text-[var(--tone-orange-fg)]",
      iconBg: "bg-[var(--tone-orange-bg)]",
      icon: "text-[var(--tone-orange-fg)]",
      hoverBorder: "hover:border-[var(--tone-orange-fg)]",
      value: "text-[var(--tone-orange-fg)]",
    },
    slate: {
      label: "text-[var(--tone-slate-fg)]",
      iconBg: "bg-[var(--tone-slate-bg)]",
      icon: "text-[var(--tone-slate-fg)]",
      hoverBorder: "hover:border-[var(--tone-slate-fg)]",
      value: "text-[var(--text-primary)]",
    },
  } as const;

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-5" dir="auto">
      <div>
        <h1 className="font-[var(--font-headline)] text-[28px] font-bold leading-9 text-[var(--text-primary)]">
          Dashboard
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
          {companyLabel} — fleet overview
        </p>
      </div>

      <section className="mt-6" aria-label="Health summary">
        <h2 className="font-[var(--font-headline)] text-[18px] font-semibold text-[var(--text-primary)]">
          Health summary
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["expired", healthByStatus.expired],
              ["critical", healthByStatus.critical],
              ["expiring", healthByStatus.expiring],
            ] as const
          ).map(([status, n]) => (
            <span
              key={status}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1 text-[13px]"
            >
              <StatusPill status={status} />
              <span className="nums text-[var(--text-secondary)]">{n}</span>
              <span className="sr-only">{STATUS_LABELS[status]}</span>
            </span>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:inline-block" />
          {(
            [
              ["certificate", healthByKind.certificate],
              ["crew_certificate", healthByKind.crew_certificate],
              ["insurance", healthByKind.insurance],
              ["deficiency", healthByKind.deficiency],
            ] as const satisfies readonly [AlertKind, number][]
          ).map(([kind, n]) => (
            <span
              key={kind}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1 text-[13px] text-[var(--text-secondary)]"
            >
              <span>{alertKindLabel(kind)}</span>
              <span className="nums font-medium">{n}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-label="Summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((card) => {
            const t = TONE[card.tone];
            const valueTone = card.valueTone
              ? TONE[card.valueTone].value
              : t.value;
            const Icon = card.icon;
            const body = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${t.label}`}
                  >
                    {card.label}
                  </p>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.iconBg}`}
                  >
                    <Icon className={`h-4 w-4 ${t.icon}`} aria-hidden="true" />
                  </span>
                </div>
                <p className={`mt-3 text-3xl font-bold nums ${valueTone}`}>
                  {card.value}
                </p>
              </>
            );
            const baseClass =
              "rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition-all";
            const interactiveClass = card.href
              ? `${baseClass} hover:-translate-y-0.5 hover:shadow-md hover:border-dashed ${t.hoverBorder}`
              : baseClass;
            return card.href ? (
              <Link
                key={card.label}
                href={card.href}
                className={interactiveClass}
              >
                {body}
              </Link>
            ) : (
              <div key={card.label} className={baseClass}>
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-[var(--font-headline)] text-[18px] font-semibold text-[var(--text-primary)]">
              Certificates due soon
            </h2>
            <Link
              href="/dashboard/alerts?kind=certificate"
              className="text-[13px] font-medium text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </div>
          <AlertsList
            items={certificatesDueSoon}
            emptyMessage="No certificates due soon."
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-[var(--font-headline)] text-[18px] font-semibold text-[var(--text-primary)]">
              Open deficiencies
            </h2>
            <Link
              href="/dashboard/alerts?kind=deficiency"
              className="text-[13px] font-medium text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </div>
          <AlertsList
            items={openDeficiencyAlerts}
            emptyMessage="No open deficiencies due soon."
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-[var(--font-headline)] text-[18px] font-semibold text-[var(--text-primary)]">
              Missing monthly forms
            </h2>
            <Link
              href="/dashboard/monthly-forms"
              className="text-[13px] font-medium text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </div>
          <MissingMonthlyFormsPreview rows={missingMonthlyForms} />
        </section>

        {!skipRecentActivity ? (
          <section className="space-y-3">
            <h2 className="font-[var(--font-headline)] text-[18px] font-semibold text-[var(--text-primary)]">
              Recent activity
            </h2>
            <RecentActivityList items={recentActivity} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function countBy<T, K extends string>(
  items: T[],
  key: (item: T) => string,
  keys: readonly K[],
): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const item of items) {
    const k = key(item);
    if (k in out) out[k as K] += 1;
  }
  return out;
}

function MissingMonthlyFormsPreview({
  rows,
}: {
  rows: MonthlyFormListItem[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[13px] text-[var(--text-tertiary)]">
        No missing monthly forms this month.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
      <table className="min-w-full text-left text-[13px]">
        <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">Vessel</th>
            <th className="px-4 py-3 font-medium">Form</th>
            <th className="px-4 py-3 font-medium">Period</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.slice(0, PREVIEW_LIMIT).map((row) => (
            <tr key={row.id} className="bg-[var(--bg-card)]">
              <td className="px-4 py-3 text-[var(--text-secondary)]">
                <Identifier>{row.vesselName}</Identifier>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/monthly-forms/${row.id}`}
                  className="font-medium text-[var(--text-primary)] hover:underline"
                >
                  {row.formName}
                </Link>
              </td>
              <td className="px-4 py-3 tabular-nums text-[var(--text-secondary)]">
                {row.month}/{row.year}
              </td>
              <td className="px-4 py-3">
                <StatusPill tone={monthlyFormDisplayStatusTone(row.displayStatus)}>
                  {monthlyFormDisplayStatusLabel(row.displayStatus)}
                </StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentActivityList({
  items,
}: {
  items: Awaited<ReturnType<typeof getRecentActivity>>;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-[13px] text-[var(--text-tertiary)]">
        No recent activity yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-0.5 bg-[var(--bg-card)] px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <p className="text-[13px] text-[var(--text-primary)]">
              {item.description}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
              {item.userName ?? "System"}
            </p>
          </div>
          <time
            dateTime={item.createdAt.toISOString()}
            className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]"
            title={item.createdAt.toISOString()}
          >
            {formatRelativeTime(item.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function formatRelativeTime(date: Date, now = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  return rtf.format(Math.round(months / 12), "year");
}
