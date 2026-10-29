import { uuidSearchParam } from "@/lib/validation/search-params";
import { DeficienciesList } from "@/components/deficiencies-list";
import {
  listDeficiencies,
  listDeficiencySources,
} from "@/modules/deficiencies/deficiency.controller";
import { listPscInspections } from "@/modules/psc/psc.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";
import { parseDeficiencyStatusFilter } from "@/modules/deficiencies/deficiency.model";

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

  const status = parseDeficiencyStatusFilter(sp.status);

  let rows;
  let vessels;
  let sources;
  let pscInspections;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    rows = await listDeficiencies(access, {
      vesselId: uuidSearchParam(sp.vesselId),
      status,
      sourceId: uuidSearchParam(sp.sourceId),
      category: sp.category || undefined,
    });
    vessels = await listSelectableVessels(access);
    sources = await listDeficiencySources(access);
    pscInspections = await listPscInspections(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

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
