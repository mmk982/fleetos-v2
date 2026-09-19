import { PscInspectionsList } from "@/components/psc-inspections-list";
import { listPscInspections } from "@/modules/psc/psc.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { getModuleAccess } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import type { PscInspectionResult, UserRole } from "@/db/schema";
import { PSC_INSPECTION_RESULTS } from "@/modules/psc/psc.model";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  result?: string;
}>;

export default async function PscPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const result = PSC_INSPECTION_RESULTS.includes(
    sp.result as PscInspectionResult,
  )
    ? (sp.result as PscInspectionResult)
    : undefined;

  const [rows, vessels] = await Promise.all([
    listPscInspections(access, {
      vesselId: sp.vesselId || undefined,
      result,
    }),
    listSelectableVessels(access),
  ]);

  const canWrite =
    getModuleAccess(access.role as UserRole | null, "psc") === "write";

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          PSC
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Port State Control inspections by vessel.
        </p>
      </div>

      <PscInspectionsList
        rows={rows}
        vessels={vessels}
        canWrite={canWrite}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          result: sp.result ?? "",
        }}
      />
    </main>
  );
}
