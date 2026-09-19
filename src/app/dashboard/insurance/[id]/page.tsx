import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { InsuranceAttachments } from "@/components/insurance-attachments";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import { deleteInsuranceFormAction } from "@/modules/insurance/actions";
import { getInsurancePolicyById } from "@/modules/insurance/insurance.controller";
import { insuranceTypeLabel } from "@/modules/insurance/insurance.model";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function InsuranceDetailPage(props: PageProps) {
  const session = await requireSession();
  const { id } = await props.params;
  const row = await getInsurancePolicyById(toAccessContext(session), id);
  if (!row) notFound();

  const coverage =
    row.coverageAmount != null
      ? `${row.coverageAmount.toLocaleString()}${row.currency ? ` ${row.currency}` : ""}`
      : "—";

  const fields: { label: string; value: ReactNode }[] = [
    {
      label: "Vessel",
      value: <Identifier>{row.vesselName}</Identifier>,
    },
    { label: "Type", value: insuranceTypeLabel(row.policyType) },
    {
      label: "Status",
      value: <StatusPill status={row.compliance.status} />,
    },
    { label: "Provider", value: row.provider ?? "—" },
    {
      label: "Policy number",
      value: row.policyNumber ? (
        <Identifier>{row.policyNumber}</Identifier>
      ) : (
        "—"
      ),
    },
    { label: "Coverage", value: coverage },
    { label: "Start", value: row.startDate ?? "—" },
    { label: "Expiry", value: row.expiryDate ?? "—" },
    { label: "Notes", value: row.notes ?? "—" },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/insurance"
            className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
          >
            ← Back to insurance
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {insuranceTypeLabel(row.policyType)}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            <Identifier>{row.vesselName}</Identifier>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/insurance/${row.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
          >
            Edit
          </Link>
          <ConfirmDeleteButton
            id={row.id}
            title="Delete insurance policy?"
            description="This permanently removes the policy and its attachments."
            action={deleteInsuranceFormAction}
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

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Attachments
        </h2>
        <div className="mt-4">
          <InsuranceAttachments
            insurancePolicyId={row.id}
            attachments={row.attachments}
          />
        </div>
      </section>
    </main>
  );
}
