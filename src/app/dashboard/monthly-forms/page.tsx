import { uuidSearchParam } from "@/lib/validation/search-params";
import { MonthlyFormsList } from "@/components/monthly-forms-list";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { planMonthlyFormsPageData } from "@/lib/auth/page-access";
import { listIsmTemplates } from "@/modules/ism-templates/ismTemplate.controller";
import { listMonthlyFormRequirements } from "@/modules/monthly-forms/monthly-form-requirement.controller";
import { listMonthlyForms } from "@/modules/monthly-forms/monthlyForm.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import {
  requireScopedVesselId,
  toAccessContext,
} from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import type { MonthlyFormStatus, UserRole, VesselRow } from "@/db/schema";
import {
  MONTHLY_FORM_STATUSES,
  type MonthlyFormListItem,
  type MonthlyFormRequirementListItem,
} from "@/modules/monthly-forms/monthlyForm.model";
import type { IsmTemplateListItem } from "@/modules/ism-templates/ismTemplate.model";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  month?: string;
  year?: string;
  formType?: string;
  displayStatus?: string;
  status?: string;
}>;

export default async function MonthlyFormsPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;
  const plan = planMonthlyFormsPageData(access.role as UserRole | null);

  const month = sp.month ? Number(sp.month) : undefined;
  const year = sp.year ? Number(sp.year) : undefined;
  const status =
    sp.status &&
    (MONTHLY_FORM_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as MonthlyFormStatus)
      : undefined;

  let rows: MonthlyFormListItem[];
  let requirements: MonthlyFormRequirementListItem[];
  let vessels: VesselRow[];
  let templates: IsmTemplateListItem[];
  try {
    // Submit helpers return [] without a vessel; still surface the notice
    // for unassigned vessel-scoped roles (same as other module lists).
    requireScopedVesselId(access);

    // Sequential: each helper may open withDb; avoid stacking concurrent
    // queries if nested under a shared transaction client.
    rows = await listMonthlyForms(access, {
      vesselId: uuidSearchParam(sp.vesselId),
      month: Number.isFinite(month) ? month : undefined,
      year: Number.isFinite(year) ? year : undefined,
      status,
    });
    requirements = plan.loadRequirements
      ? await listMonthlyFormRequirements(access, {
          vesselId: uuidSearchParam(sp.vesselId),
        })
      : [];
    vessels = await listSelectableVessels(access);
    templates = plan.canManageRequirements
      ? await listIsmTemplates(access)
      : [];
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Monthly Executed Forms
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Per-vessel checklist of required ISM forms for each period.
        </p>
      </div>

      <MonthlyFormsList
        rows={rows}
        requirements={requirements}
        vessels={vessels}
        templates={templates}
        canManageRequirements={plan.canManageRequirements}
        canCreateAdHoc={plan.canCreateAdHoc}
        canGenerateChecklist={plan.canGenerateChecklist}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          month: sp.month ?? "",
          year: sp.year ?? "",
          formType: sp.formType ?? "",
          displayStatus: sp.displayStatus ?? "",
        }}
      />
    </main>
  );
}
