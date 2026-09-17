import { CrewList } from "@/components/crew-list";
import {
  listCrewCategories,
  listCrewMembers,
} from "@/modules/crew/crew.controller";
import { CREW_STATUSES } from "@/modules/crew/crew.model";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import type { CrewStatus } from "@/db/schema";

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

  const [rows, vessels, categories] = await Promise.all([
    listCrewMembers(access, {
      vesselId: sp.vesselId || undefined,
      status,
      categoryId: sp.categoryId || undefined,
    }),
    listSelectableVessels(access),
    listCrewCategories(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Crew
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Members, vessel assignment, and personal documents — GDPR-scoped
          access logging on detail views only.
        </p>
      </div>

      <CrewList
        rows={rows}
        vessels={vessels}
        categories={categories}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          status: sp.status ?? "",
          categoryId: sp.categoryId ?? "",
        }}
      />
    </main>
  );
}
