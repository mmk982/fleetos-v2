import { uuidSearchParam } from "@/lib/validation/search-params";
import Link from "next/link";
import { CertificatesList } from "@/components/certificates-list";
import { NoVesselAssignedNotice } from "@/components/no-vessel-assigned-notice";
import {
  listCertificates,
  listIssuingAuthorities,
} from "@/modules/certificates/certificate.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import {
  isMissingVesselAssignmentError,
  toAccessContext,
} from "@/lib/auth/access";
import { getModuleAccess } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import type { UserRole } from "@/db/schema";
import type { ComplianceStatus } from "@/lib/expiry";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  authority?: string;
  issuingAuthorityId?: string;
  status?: string;
}>;

const STATUS_FILTERS: ComplianceStatus[] = [
  "valid",
  "expiring",
  "critical",
  "expired",
  "unknown",
  "revoked",
];

export default async function CertificatesPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const status = STATUS_FILTERS.includes(sp.status as ComplianceStatus)
    ? (sp.status as ComplianceStatus)
    : undefined;

  const canWrite =
    getModuleAccess(access.role as UserRole | null, "certificates") ===
    "write";

  let rows;
  let vessels;
  let issuers;
  try {
    [rows, vessels, issuers] = await Promise.all([
      listCertificates(access, {
        vesselId: uuidSearchParam(sp.vesselId),
        authority: sp.authority || undefined,
        issuingAuthorityId: uuidSearchParam(sp.issuingAuthorityId),
        status,
      }),
      listSelectableVessels(access),
      listIssuingAuthorities(access),
    ]);
  } catch (error) {
    if (isMissingVesselAssignmentError(error, access)) {
      return <NoVesselAssignedNotice />;
    }
    throw error;
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Certificates
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Vessel compliance certificates with live expiry status.
          </p>
        </div>
        {canWrite ? (
          <Link
            href="/dashboard/certificates/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
          >
            Add certificate
          </Link>
        ) : null}
      </div>

      <CertificatesList
        rows={rows}
        vessels={vessels}
        issuers={issuers}
        canWrite={canWrite}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          authority: sp.authority ?? "",
          issuingAuthorityId: sp.issuingAuthorityId ?? "",
          status: sp.status ?? "",
        }}
      />
    </main>
  );
}
