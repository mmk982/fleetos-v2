import { uuidSearchParam } from "@/lib/validation/search-params";
import { DrawingsList } from "@/components/drawings-list";
import {
  listDrawingCategories,
  listDrawings,
} from "@/modules/drawings/drawing.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  categoryId?: string;
}>;

export default async function DrawingsPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  let rows;
  let vessels;
  let categories;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    rows = await listDrawings(access, {
      vesselId: uuidSearchParam(sp.vesselId),
      categoryId: uuidSearchParam(sp.categoryId),
    });
    vessels = await listSelectableVessels(access);
    categories = await listDrawingCategories(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Drawings
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Vessel technical drawings with file attachments.
        </p>
      </div>

      <DrawingsList
        rows={rows}
        vessels={vessels}
        categories={categories}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          categoryId: sp.categoryId ?? "",
        }}
      />
    </main>
  );
}
