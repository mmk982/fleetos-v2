import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { MonthlyFormDetailActions } from "@/components/monthly-form-detail-actions";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import { deleteMonthlyFormFormAction } from "@/modules/monthly-forms/actions";
import { getMonthlyFormById } from "@/modules/monthly-forms/monthlyForm.controller";
import {
  monthlyFormDisplayStatusLabel,
  monthlyFormDisplayStatusTone,
} from "@/modules/monthly-forms/monthlyForm.model";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function MonthlyFormDetailPage(props: PageProps) {
  const session = await requireSession();
  const { id } = await props.params;
  const row = await getMonthlyFormById(toAccessContext(session), id);
  if (!row) notFound();

  const fields: { label: string; value: ReactNode }[] = [
    {
      label: "Vessel",
      value: <Identifier>{row.vesselName}</Identifier>,
    },
    { label: "Period", value: `${row.month}/${row.year}` },
    {
      label: "Type",
      value: row.required ? "Checklist" : "Ad-hoc",
    },
    {
      label: "Status",
      value: (
        <StatusPill tone={monthlyFormDisplayStatusTone(row.displayStatus)}>
          {monthlyFormDisplayStatusLabel(row.displayStatus)}
        </StatusPill>
      ),
    },
    {
      label: "Uploaded",
      value: row.uploadedAt
        ? row.uploadedAt.toISOString().slice(0, 10)
        : "—",
    },
    { label: "Remarks", value: row.remarks ?? "—" },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/monthly-forms"
            className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
          >
            ← Back to monthly forms
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {row.formName}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            <Identifier>{row.vesselName}</Identifier>
            {` · ${row.month}/${row.year}`}
          </p>
        </div>
        <ConfirmDeleteButton
          id={row.id}
          title="Delete executed form?"
          description="This permanently removes the form row and its attachments."
          action={deleteMonthlyFormFormAction}
        />
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
        <MonthlyFormDetailActions
          executedFormId={row.id}
          attachments={row.attachments}
        />
      </section>
    </main>
  );
}
