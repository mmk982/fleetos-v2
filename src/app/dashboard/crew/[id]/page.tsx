import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CrewCertificatesSection } from "@/components/crew-certificates-section";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import {
  deleteCrewMemberFormAction,
  scrubCrewMemberPiiFormAction,
} from "@/modules/crew/actions";
import {
  getCrewMemberById,
  listEndorsementTypes,
} from "@/modules/crew/crew.controller";
import {
  listCrewCertificateAttachments,
  listCrewCertificates,
} from "@/modules/crew/crew-certificate.controller";
import {
  crewMemberDisplayName,
  crewMemberStatusLabel,
  crewMemberStatusTone,
} from "@/modules/crew/crew.model";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function CrewDetailPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  const member = await getCrewMemberById(access, id, { logView: true });
  if (!member) notFound();

  const [certs, endorsementTypes] = await Promise.all([
    listCrewCertificates(access, id),
    listEndorsementTypes(access),
  ]);

  const certificates = await Promise.all(
    certs.map(async (cert) => ({
      ...cert,
      attachments: await listCrewCertificateAttachments(access, cert.id),
    })),
  );

  const fields: { label: string; value: ReactNode }[] = [
    {
      label: "Category",
      value: member.categoryName ?? "—",
    },
    {
      label: "Vessel",
      value: member.vesselName ? (
        <Identifier>{member.vesselName}</Identifier>
      ) : (
        "Unassigned"
      ),
    },
    {
      label: "Status",
      value: (
        <StatusPill tone={crewMemberStatusTone(member.status)}>
          {crewMemberStatusLabel(member.status)}
        </StatusPill>
      ),
    },
    { label: "Nationality", value: member.nationality ?? "—" },
    { label: "Date of birth", value: member.dateOfBirth ?? "—" },
    { label: "Notes", value: member.notes ?? "—" },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/crew"
            className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
          >
            ← Back to crew
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {crewMemberDisplayName(member)}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Personal data view is access-logged.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/crew/${member.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
          >
            Edit
          </Link>
          <ConfirmDeleteButton
            label="Scrub PII"
            title="Scrub personal data?"
            description="Nulls names, DOB, nationality, document numbers/dates, and deletes passport/visa attachment files. The crew row remains."
            id={member.id}
            action={scrubCrewMemberPiiFormAction}
          />
          <ConfirmDeleteButton
            title="Delete crew member?"
            description="Hard-delete. Blocked if certificates still exist — scrub or delete documents first."
            id={member.id}
            action={deleteCrewMemberFormAction}
          />
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {f.label}
            </dt>
            <dd className="mt-1 text-sm text-[var(--text-primary)]">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      <CrewCertificatesSection
        crewMemberId={member.id}
        certificates={certificates}
        endorsementTypes={endorsementTypes}
      />
    </main>
  );
}
