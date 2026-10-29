import { uuidSearchParam } from "@/lib/validation/search-params";
import { ManualsList } from "@/components/manuals-list";
import { listManuals } from "@/modules/manuals/manual.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
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

  let rows;
  let vessels;
  let optionRows;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    rows = await listManuals(access, {
      vesselId: uuidSearchParam(sp.vesselId),
      manualType: sp.manualType || undefined,
      department: sp.department || undefined,
    });
    vessels = await listSelectableVessels(access);
    optionRows = await listManuals(access, {
      vesselId: uuidSearchParam(sp.vesselId),
    });
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

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
