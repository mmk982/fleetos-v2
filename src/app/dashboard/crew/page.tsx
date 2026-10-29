import { uuidSearchParam } from "@/lib/validation/search-params";
import { CrewList } from "@/components/crew-list";
import { NoVesselAssignedNotice } from "@/components/no-vessel-assigned-notice";
import {
  listCrewCategories,
  listCrewMembers,
} from "@/modules/crew/crew.controller";
import { CREW_STATUSES } from "@/modules/crew/crew.model";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import {
  isMissingVesselAssignmentError,
  toAccessContext,
} from "@/lib/auth/access";
import { getModuleAccess } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import type { CrewStatus, UserRole } from "@/db/schema";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  status?: string;
  categoryId?: string;
}>;

export default async function CrewPage(props: { searchParams: SearchParams }) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const status = CREW_STATUSES.includes(sp.status as CrewStatus)
    ? (sp.status as CrewStatus)
    : undefined;

  const canWrite =
    getModuleAccess(access.role as UserRole | null, "crew") === "write";

  let rows;
  let vessels;
  let categories;
  try {
    [rows, vessels, categories] = await Promise.all([
      listCrewMembers(access, {
        vesselId: uuidSearchParam(sp.vesselId),
        status,
        categoryId: uuidSearchParam(sp.categoryId),
      }),
      listSelectableVessels(access),
      listCrewCategories(access),
    ]);
  } catch (error) {
    if (isMissingVesselAssignmentError(error, access)) {
      return <NoVesselAssignedNotice />;
    }
    throw error;
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Crew
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Members, vessel assignment, and personal documents — GDPR-scoped
          access logging on detail views only.
        </p>
      </div>

      <CrewList
        rows={rows}
        vessels={vessels}
        categories={categories}
        canWrite={canWrite}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          status: sp.status ?? "",
          categoryId: sp.categoryId ?? "",
        }}
      />
    </main>
  );
}
