import { IsmTemplatesList } from "@/components/ism-templates-list";
import {
  listIsmTemplateCategories,
  listIsmTemplates,
} from "@/modules/ism-templates/ismTemplate.controller";
import { ISM_TEMPLATE_STATUSES } from "@/modules/ism-templates/ismTemplate.model";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import type { IsmTemplateStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  categoryId?: string;
  status?: string;
}>;

export default async function IsmTemplatesPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const status = ISM_TEMPLATE_STATUSES.includes(sp.status as IsmTemplateStatus)
    ? (sp.status as IsmTemplateStatus)
    : undefined;

  const [rows, categories] = await Promise.all([
    listIsmTemplates(access, {
      categoryId: sp.categoryId || undefined,
      status,
    }),
    listIsmTemplateCategories(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          ISM Templates
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Fleet-wide blank forms — not vessel-specific. Monthly forms will
          execute these later.
        </p>
      </div>

      <IsmTemplatesList
        rows={rows}
        categories={categories}
        initialFilters={{
          categoryId: sp.categoryId ?? "",
          status: sp.status ?? "",
        }}
      />
    </main>
  );
}
