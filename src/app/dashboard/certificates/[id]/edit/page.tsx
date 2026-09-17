import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateForm } from "@/components/certificate-form";
import {
  getCertificateById,
  listCertificateTypes,
  listIssuingAuthorities,
} from "@/modules/certificates/certificate.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditCertificatePage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;
  const [cert, vessels, types, authorities] = await Promise.all([
    getCertificateById(access, id),
    listSelectableVessels(access),
    listCertificateTypes(access),
    listIssuingAuthorities(access),
  ]);
  if (!cert) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="mb-8">
        <Link
          href={`/dashboard/certificates/${cert.id}`}
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Back to certificate
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Edit certificate
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
      />
    </main>
  );
}
