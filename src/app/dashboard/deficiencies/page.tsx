import { DeficienciesList } from "@/components/deficiencies-list";
import {
  listDeficiencies,
  listDeficiencySources,
} from "@/modules/deficiencies/deficiency.controller";
import { listPscInspections } from "@/modules/psc/psc.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import type { DeficiencyStatus } from "@/db/schema";
import { DEFICIENCY_STATUSES } from "@/modules/deficiencies/deficiency.model";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  status?: string;
  sourceId?: string;
  category?: string;
}>;

export default async function DeficienciesPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const status = DEFICIENCY_STATUSES.includes(sp.status as DeficiencyStatus)
    ? (sp.status as DeficiencyStatus)
    : undefined;

  const [rows, vessels, sources, pscInspections] = await Promise.all([
    listDeficiencies(access, {
      vesselId: sp.vesselId || undefined,
      status,
      sourceId: sp.sourceId || undefined,
      category: sp.category || undefined,
    }),
    listSelectableVessels(access),
    listDeficiencySources(access),
    listPscInspections(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Deficiencies
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Findings and corrective actions by vessel — stored 4-state status.
        </p>
      </div>

      <DeficienciesList
        rows={rows}
        vessels={vessels}
        sources={sources}
        pscInspections={pscInspections}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          status: sp.status ?? "",
          sourceId: sp.sourceId ?? "",
          category: sp.category ?? "",
        }}
      />
    </main>
  );
}
