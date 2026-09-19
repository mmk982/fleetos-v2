import { MonthlyFormsList } from "@/components/monthly-forms-list";
import { listIsmTemplates } from "@/modules/ism-templates/ismTemplate.controller";
import { listMonthlyFormRequirements } from "@/modules/monthly-forms/monthly-form-requirement.controller";
import { listMonthlyForms } from "@/modules/monthly-forms/monthlyForm.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import type { MonthlyFormStatus } from "@/db/schema";
import { MONTHLY_FORM_STATUSES } from "@/modules/monthly-forms/monthlyForm.model";

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

  const month = sp.month ? Number(sp.month) : undefined;
  const year = sp.year ? Number(sp.year) : undefined;
  const status =
    sp.status &&
    (MONTHLY_FORM_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as MonthlyFormStatus)
      : undefined;

  const [rows, requirements, vessels, templates] = await Promise.all([
    listMonthlyForms(access, {
      vesselId: sp.vesselId || undefined,
      month: Number.isFinite(month) ? month : undefined,
      year: Number.isFinite(year) ? year : undefined,
      status,
    }),
    listMonthlyFormRequirements(access, {
      vesselId: sp.vesselId || undefined,
    }),
    listSelectableVessels(access),
    listIsmTemplates(access),
  ]);

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
