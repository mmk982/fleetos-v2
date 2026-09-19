import { AuditsList } from "@/components/audits-list";
import { listAudits } from "@/modules/audits/audit.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { getModuleAccess } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import type { AuditType, UserRole } from "@/db/schema";
import { AUDIT_TYPES } from "@/modules/audits/audit.model";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  auditType?: string;
}>;

export default async function AuditsPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const auditType = AUDIT_TYPES.includes(sp.auditType as AuditType)
    ? (sp.auditType as AuditType)
    : undefined;

  const [rows, vessels] = await Promise.all([
    listAudits(access, {
      vesselId: sp.vesselId || undefined,
      auditType,
    }),
    listSelectableVessels(access),
  ]);

  const canWrite =
    getModuleAccess(access.role as UserRole | null, "audits") === "write";

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Audits
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          ISSC / MLC / SMC / DOC audit log by vessel.
        </p>
      </div>

      <AuditsList
        rows={rows}
        vessels={vessels}
        canWrite={canWrite}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          auditType: sp.auditType ?? "",
        }}
      />
    </main>
  );
}
