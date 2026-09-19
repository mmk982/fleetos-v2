import { ManualsList } from "@/components/manuals-list";
import { listManuals } from "@/modules/manuals/manual.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  manualType?: string;
  department?: string;
}>;

export default async function ManualsPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const [rows, vessels, optionRows] = await Promise.all([
    listManuals(access, {
      vesselId: sp.vesselId || undefined,
      manualType: sp.manualType || undefined,
      department: sp.department || undefined,
    }),
    listSelectableVessels(access),
    listManuals(access, { vesselId: sp.vesselId || undefined }),
  ]);

  const manualTypes = [
    ...new Set(
      optionRows
        .map((r) => r.manualType)
        .filter((t): t is string => Boolean(t)),
    ),
  ].sort();
  const departments = [
    ...new Set(
      optionRows
        .map((r) => r.department)
        .filter((d): d is string => Boolean(d)),
    ),
  ].sort();

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Manuals
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Vessel-linked manuals with revision history.
        </p>
      </div>

      <ManualsList
        rows={rows}
        vessels={vessels}
        manualTypes={manualTypes}
        departments={departments}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          manualType: sp.manualType ?? "",
          department: sp.department ?? "",
        }}
      />
    </main>
  );
}
