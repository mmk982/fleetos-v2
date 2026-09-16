/**
 * Fleet health dashboard — summary cards, alert previews, recent activity.
 * Spec: PROJECT_PLAN.md §6.
 */
import Link from "next/link";
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
import { getVesselCount } from "@/modules/vessels/vessel.controller";

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
  ] = await Promise.all([
    getAlerts(access),
    getAlerts(access, {
      kinds: ["certificate"],
      statuses: CERT_COUNT_STATUSES,
    }),
    getAlerts(access, { kinds: ["certificate"], limit: PREVIEW_LIMIT }),
    getAlerts(access, { kinds: ["deficiency"], limit: PREVIEW_LIMIT }),
    listMonthlyForms(access, { month, year, status: "pending" }),
    getVesselCount(access),
    getOpenDeficienciesCount(access),
    getManualCount(access),
    getRecentActivity(access, { limit: ACTIVITY_LIMIT }),
    // Lazy notification sweep — runs in parallel; errors are logged inside.
    syncNotifications(access),
  ]);

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

  const stats: { label: string; value: number; href?: string }[] = [
    { label: "Total vessels", value: vesselCount, href: "/dashboard/vessels" },
    {
      label: "Valid certificates",
      value: validCertificates,
      href: "/dashboard/certificates",
    },
    {
      label: "Due soon certificates",
      value: dueSoonCertificates,
      href: "/dashboard/alerts?kind=certificate",
    },
    {
      label: "Expired certificates",
      value: expiredCertificates,
      href: "/dashboard/alerts?kind=certificate&status=expired",
    },
    {
      label: "Missing monthly forms",
      value: missingMonthlyForms.length,
      href: "/dashboard/monthly-forms",
    },
    {
      label: "Open deficiencies",
      value: openDeficienciesCount,
      href: "/dashboard/deficiencies",
    },
    { label: "Total manuals", value: manualCount, href: "/dashboard/manuals" },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Fleet health overview — live alerts, counts, and recent activity.
        </p>
      </div>

      <section className="mt-6" aria-label="Health summary">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <StatusPill status={status} />
              <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                {n}
              </span>
              <span className="sr-only">{STATUS_LABELS[status]}</span>
            </span>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-zinc-200 sm:inline-block dark:bg-zinc-800" />
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
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              <span>{alertKindLabel(kind)}</span>
              <span className="tabular-nums font-medium">{n}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-label="Summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {stats.map((card) => {
            const body = (
              <>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                  {card.value}
                </p>
              </>
            );
            const className =
              "rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950";
            return card.href ? (
              <Link
                key={card.label}
                href={card.href}
                className={`${className} transition-colors hover:border-[#378ADD]`}
              >
                {body}
              </Link>
            ) : (
              <div key={card.label} className={className}>
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Certificates due soon
            </h2>
            <Link
              href="/dashboard/alerts?kind=certificate"
              className="text-sm font-medium text-[#378ADD] hover:underline"
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
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Open deficiencies
            </h2>
            <Link
              href="/dashboard/alerts?kind=deficiency"
              className="text-sm font-medium text-[#378ADD] hover:underline"
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
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Missing monthly forms
            </h2>
            <Link
              href="/dashboard/monthly-forms"
              className="text-sm font-medium text-[#378ADD] hover:underline"
            >
              View all
            </Link>
          </div>
          <MissingMonthlyFormsPreview rows={missingMonthlyForms} />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Recent activity
          </h2>
          <RecentActivityList items={recentActivity} />
        </section>
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
      <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No missing monthly forms this month.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
          <tr>
            <th className="px-4 py-3 font-medium">Vessel</th>
            <th className="px-4 py-3 font-medium">Form</th>
            <th className="px-4 py-3 font-medium">Period</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.slice(0, PREVIEW_LIMIT).map((row) => (
            <tr key={row.id} className="bg-white dark:bg-zinc-950">
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                <Identifier>{row.vesselName}</Identifier>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/monthly-forms/${row.id}`}
                  className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {row.formName}
                </Link>
              </td>
              <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
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
      <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No recent activity yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-0.5 bg-white px-4 py-3 dark:bg-zinc-950 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <p className="text-sm text-zinc-900 dark:text-zinc-50">
              {item.description}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {item.userName ?? "System"}
            </p>
          </div>
          <time
            dateTime={item.createdAt.toISOString()}
            className="shrink-0 text-xs tabular-nums text-zinc-500"
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
