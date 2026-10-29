import { uuidSearchParam } from "@/lib/validation/search-params";
import { InsuranceList } from "@/components/insurance-list";
import { listInsurancePolicies } from "@/modules/insurance/insurance.controller";
import { INSURANCE_TYPES } from "@/modules/insurance/insurance.model";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";
import type { InsuranceType } from "@/db/schema";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  policyType?: string;
}>;

export default async function InsurancePage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const policyType = INSURANCE_TYPES.includes(sp.policyType as InsuranceType)
    ? (sp.policyType as InsuranceType)
    : undefined;

  let rows;
  let vessels;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    rows = await listInsurancePolicies(access, {
      vesselId: uuidSearchParam(sp.vesselId),
      policyType,
    });
    vessels = await listSelectableVessels(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Insurance
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Vessel policies with a fixed 30-day expiry reminder.
        </p>
      </div>

      <InsuranceList
        rows={rows}
        vessels={vessels}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          policyType: sp.policyType ?? "",
        }}
      />
    </main>
  );
}
