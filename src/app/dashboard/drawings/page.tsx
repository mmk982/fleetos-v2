import { DrawingsList } from "@/components/drawings-list";
import {
  listDrawingCategories,
  listDrawings,
} from "@/modules/drawings/drawing.controller";
import { listVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
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

  const [rows, vessels, categories] = await Promise.all([
    listDrawings(access, {
      vesselId: sp.vesselId || undefined,
      categoryId: sp.categoryId || undefined,
    }),
    listVessels(access),
    listDrawingCategories(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Drawings
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
