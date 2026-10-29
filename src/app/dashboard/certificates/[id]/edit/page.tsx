import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CertificateForm } from "@/components/certificate-form";
import {
  getCertificateById,
  listCertificateTypes,
  listIssuingAuthorities,
  listParentCandidates,
} from "@/modules/certificates/certificate.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { getModuleAccess } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import type { UserRole } from "@/db/schema";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditCertificatePage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;
  if (
    getModuleAccess(access.role as UserRole | null, "certificates") !== "write"
  ) {
    redirect(`/dashboard/certificates/${id}`);
  }

  let cert;
  let vessels;
  let types;
  let authorities;
  let parentCandidates;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    cert = await getCertificateById(access, id);
    vessels = await listSelectableVessels(access);
    types = await listCertificateTypes(access);
    authorities = await listIssuingAuthorities(access);
    parentCandidates = await listParentCandidates(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }
  if (!cert) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="mb-8">
        <Link
          href={`/dashboard/certificates/${cert.id}`}
          className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
        >
          ← Back to certificate
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Edit certificate
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          {cert.typeName} · {cert.vesselName}
        </p>
      </div>
      <CertificateForm
        mode="edit"
        certificateId={cert.id}
        defaultValues={cert}
        vessels={vessels}
        types={types}
        authorities={authorities}
        parentCandidates={parentCandidates}
        hasSubItems={cert.subItemCount > 0}
      />
    </main>
  );
}
