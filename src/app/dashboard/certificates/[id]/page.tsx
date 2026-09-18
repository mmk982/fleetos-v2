import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CertificateAttachments } from "@/components/certificate-attachments";
import { CertificateEventForm } from "@/components/certificate-event-form";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import { deleteCertificateFormAction } from "@/modules/certificates/actions";
import { getCertificateById } from "@/modules/certificates/certificate.controller";
import { formatAuthority } from "@/modules/certificates/certificate.model";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function CertificateDetailPage(props: PageProps) {
  const session = await requireSession();
  const { id } = await props.params;
  const cert = await getCertificateById(toAccessContext(session), id);
  if (!cert) {
    notFound();
  }

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: "Vessel",
      value: <Identifier>{cert.vesselName}</Identifier>,
    },
    { label: "Type", value: cert.typeName },
    { label: "Authority", value: formatAuthority(cert.authority) },
    {
      label: "Certificate number",
      value: (
        <span className="font-mono text-sm">
          <Identifier>{cert.certificateNumber ?? "—"}</Identifier>
        </span>
      ),
    },
    { label: "Issuing authority", value: cert.issuingAuthorityName ?? "—" },
    { label: "Issue date", value: cert.issueDate ?? "—" },
    { label: "Expiry date", value: cert.expiryDate ?? "—" },
    { label: "Window open", value: cert.windowOpenDate ?? "—" },
    { label: "Window close", value: cert.windowCloseDate ?? "—" },
    {
      label: "Reminder rule",
      value: `${cert.ruleKind}${cert.typeOffsetDays != null ? ` (${cert.typeOffsetDays}d)` : ""}`,
    },
    {
      label: "Linked to dry dock",
      value: cert.linkedToDryDock ? "Yes" : "No",
    },
    {
      label: "Custom reminder days",
      value: cert.customOffsetDays != null ? String(cert.customOffsetDays) : "—",
    },
    {
      label: "Lifecycle",
      value:
        cert.lifecycleStatus.charAt(0).toUpperCase() + cert.lifecycleStatus.slice(1),
    },
    {
      label: "Status",
      value: (
        <span className="inline-flex items-center gap-2">
          <StatusPill status={cert.compliance.status} />
          {cert.compliance.daysRemaining != null ? (
            <span className="text-xs text-zinc-500">
              {cert.compliance.daysRemaining}d
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/certificates"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            ← Back to certificates
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {cert.typeName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <Identifier>{cert.vesselName}</Identifier>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/certificates/${cert.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
          >
            Edit
          </Link>
          <ConfirmDeleteButton
            id={cert.id}
            title="Delete certificate?"
            description="This permanently removes the certificate, its events, and attachments. Prefer revoke for normal history preservation."
            action={deleteCertificateFormAction}
          />
        </div>
      </div>

      <dl className="mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {row.label}
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{row.value}</dd>
          </div>
        ))}
      </dl>

      {cert.remarks ? (
        <section className="mt-8 max-w-4xl">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Remarks</h2>
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {cert.remarks}
          </p>
        </section>
      ) : null}

      <section className="mt-10 max-w-4xl space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Events</h2>
        <ol className="relative space-y-4 border-s border-zinc-200 ps-6 dark:border-zinc-800">
          {cert.events.length === 0 ? (
            <li className="text-sm text-zinc-500">No events yet.</li>
          ) : (
            cert.events.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -start-[1.625rem] mt-1.5 h-2.5 w-2.5 rounded-md bg-[#378ADD]" />
                <p className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-100">
                  {ev.eventType}
                  <span className="ms-2 font-normal text-zinc-500">{ev.eventDate}</span>
                </p>
                {ev.newExpiryDate ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    New expiry: {ev.newExpiryDate}
                  </p>
                ) : null}
                {ev.note ? (
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{ev.note}</p>
                ) : null}
              </li>
            ))
          )}
        </ol>
        <CertificateEventForm certificateId={cert.id} />
      </section>

      <section className="mt-10 max-w-4xl space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Attachments</h2>
        <CertificateAttachments certificateId={cert.id} attachments={cert.attachments} />
      </section>
    </main>
  );
}
