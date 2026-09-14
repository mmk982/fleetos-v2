import { AlertsFilters } from "@/components/alerts-filters";
import { AlertsList } from "@/components/alerts-list";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import { getAlerts } from "@/modules/alerts/alerts.controller";
import {
  ALERT_KINDS,
  parseAlertStatusFilter,
  type AlertKind,
} from "@/modules/alerts/alerts.model";
import { listVessels } from "@/modules/vessels/vessel.controller";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  kind?: string;
  status?: string;
}>;

export default async function AlertsPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const kind = ALERT_KINDS.includes(sp.kind as AlertKind)
    ? (sp.kind as AlertKind)
    : undefined;
  const statuses = parseAlertStatusFilter(sp.status);
  const vesselId = sp.vesselId || undefined;

  const [items, missingDates, vessels] = await Promise.all([
    getAlerts(access, {
      vesselId,
      kinds: kind ? [kind] : undefined,
      statuses,
    }),
    getAlerts(access, {
      vesselId,
      kinds: kind ? [kind] : undefined,
      statuses: ["unknown"],
    }),
    listVessels(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Alerts
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          System-derived expiry feed — separate from user-set Reminders.
        </p>
      </div>

      <div className="mt-6">
        <AlertsFilters
          vessels={vessels}
          initialFilters={{
            vesselId: sp.vesselId ?? "",
            kind: sp.kind ?? "",
            status: sp.status ?? "",
          }}
        />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {statuses ? "Filtered" : "Actionable"}
        </h2>
        <AlertsList
          items={items}
          emptyMessage="No actionable alerts. Everything looks clear."
        />
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Missing dates
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Items that cannot derive an expiry status until a date is filled in.
        </p>
        <AlertsList
          items={missingDates}
          emptyMessage="No items with missing dates."
        />
      </section>
    </main>
  );
}
