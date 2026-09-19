import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Identifier } from "@/components/ui/identifier";
import { deleteAuditFormAction } from "@/modules/audits/actions";
import { getAudit } from "@/modules/audits/audit.controller";
import { auditTypeLabel } from "@/modules/audits/audit.model";
import { toAccessContext } from "@/lib/auth/access";
import { getModuleAccess } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import type { UserRole } from "@/db/schema";

type PageProps = { params: Promise<{ id: string }> };

export default async function AuditDetailPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;
  const row = await getAudit(access, id);
  if (!row) notFound();

  const canWrite =
    getModuleAccess(access.role as UserRole | null, "audits") === "write";

  const fields: { label: string; value: ReactNode }[] = [
    {
      label: "Vessel",
      value: <Identifier>{row.vesselName}</Identifier>,
    },
    { label: "Type", value: auditTypeLabel(row.auditType) },
    { label: "Date", value: row.auditDate },
    { label: "Auditor", value: row.auditor ?? "—" },
    {
      label: "Findings",
      value: (
        <span
          className={
            row.findingsCount > 0
              ? "font-medium text-[var(--warning)]"
              : undefined
          }
        >
          {row.findingsCount}
        </span>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/audits"
            className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
          >
            ← Back to Audits
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {auditTypeLabel(row.auditType)}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            <Identifier>{row.vesselName}</Identifier> · {row.auditDate}
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/audits/${row.id}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
            >
              Edit
            </Link>
            <ConfirmDeleteButton
              id={row.id}
              title="Delete audit?"
              description="This permanently removes the audit record."
              action={deleteAuditFormAction}
            />
          </div>
        ) : null}
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {f.label}
            </dt>
            <dd className="mt-1 text-sm text-[var(--text-primary)]">{f.value}</dd>
          </div>
        ))}
      </dl>

      {row.notes ? (
        <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
            {row.notes}
          </p>
        </section>
      ) : null}
    </main>
  );
}
