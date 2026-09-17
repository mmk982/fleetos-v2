import Link from "next/link";
import { CertificatesList } from "@/components/certificates-list";
import {
  listCertificates,
  listIssuingAuthorities,
} from "@/modules/certificates/certificate.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
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

  const [rows, vessels, issuers] = await Promise.all([
    listCertificates(access, {
      vesselId: sp.vesselId || undefined,
      authority: sp.authority || undefined,
      issuingAuthorityId: sp.issuingAuthorityId || undefined,
      status,
    }),
    listSelectableVessels(access),
    listIssuingAuthorities(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Certificates
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Vessel compliance certificates with live expiry status.
          </p>
        </div>
        <Link
          href="/dashboard/certificates/new"
          className="inline-flex h-10 items-center justify-center rounded-none bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Add certificate
        </Link>
      </div>

      <CertificatesList
        rows={rows}
        vessels={vessels}
        issuers={issuers}
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
