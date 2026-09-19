import Link from "next/link";
import { CertificateForm } from "@/components/certificate-form";
import {
  listCertificateTypes,
  listIssuingAuthorities,
} from "@/modules/certificates/certificate.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

export default async function NewCertificatePage() {
  const session = await requireSession();
  const access = toAccessContext(session);
  const [vessels, types, authorities] = await Promise.all([
    listSelectableVessels(access),
    listCertificateTypes(access),
    listIssuingAuthorities(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="mb-8">
        <Link
          href="/dashboard/certificates"
          className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
        >
          ← Back to certificates
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          New certificate
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Pick a vessel and type. Status is derived live from the expiry engine.
        </p>
      </div>
      <CertificateForm
        mode="create"
        vessels={vessels}
        types={types}
        authorities={authorities}
      />
    </main>
  );
}
