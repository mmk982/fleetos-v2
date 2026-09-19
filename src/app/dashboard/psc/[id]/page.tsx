import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import { deletePscInspectionFormAction } from "@/modules/psc/actions";
import { getPscInspection } from "@/modules/psc/psc.controller";
import {
  pscInspectionResultLabel,
  pscInspectionResultTone,
} from "@/modules/psc/psc.model";
import { toAccessContext } from "@/lib/auth/access";
import { getModuleAccess } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import type { UserRole } from "@/db/schema";

type PageProps = { params: Promise<{ id: string }> };

export default async function PscInspectionDetailPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;
  const row = await getPscInspection(access, id);
  if (!row) notFound();

  const canWrite =
    getModuleAccess(access.role as UserRole | null, "psc") === "write";

  const fields: { label: string; value: ReactNode }[] = [
    {
      label: "Vessel",
      value: <Identifier>{row.vesselName}</Identifier>,
    },
    { label: "Port", value: row.port },
    { label: "Date", value: row.inspectionDate },
    { label: "Authority", value: row.authority },
    {
      label: "Result",
      value: (
        <StatusPill tone={pscInspectionResultTone(row.result, row.detained)} dot>
          {pscInspectionResultLabel(row.result)}
        </StatusPill>
      ),
    },
    {
      label: "Detained",
      value: row.detained ? (
        <StatusPill tone="danger" dot>
          Detained
        </StatusPill>
      ) : (
        "No"
      ),
    },
    { label: "Inspector", value: row.inspectorName ?? "—" },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/psc"
            className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
          >
            ← Back to PSC
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {row.port}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            <Identifier>{row.vesselName}</Identifier> · {row.inspectionDate}
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/psc/${row.id}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
            >
              Edit
            </Link>
            <ConfirmDeleteButton
              id={row.id}
              title="Delete PSC inspection?"
              description="Linked deficiencies keep their records; the inspection link is cleared."
              action={deletePscInspectionFormAction}
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
