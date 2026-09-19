import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DeficiencyAttachments } from "@/components/deficiency-attachments";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import {
  closeDeficiencyFormAction,
  deleteDeficiencyFormAction,
  reopenDeficiencyFormAction,
  setMonitoringDeficiencyFormAction,
  startProgressDeficiencyFormAction,
} from "@/modules/deficiencies/actions";
import { getDeficiencyById } from "@/modules/deficiencies/deficiency.controller";
import {
  deficiencySourceLabel,
  deficiencyStatusLabel,
  deficiencyStatusTone,
} from "@/modules/deficiencies/deficiency.model";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function DeficiencyDetailPage(props: PageProps) {
  const session = await requireSession();
  const { id } = await props.params;
  const row = await getDeficiencyById(toAccessContext(session), id);
  if (!row) notFound();

  const fields: { label: string; value: ReactNode }[] = [
    {
      label: "Vessel",
      value: <Identifier>{row.vesselName}</Identifier>,
    },
    {
      label: "Number",
      value: (
        <span className="font-mono text-sm">
          <Identifier>{row.deficiencyNumber ?? "—"}</Identifier>
        </span>
      ),
    },
    { label: "Category", value: row.category ?? "—" },
    { label: "Source", value: deficiencySourceLabel(row.sourceName) },
    ...(row.pscInspectionId
      ? [
          {
            label: "PSC Inspection",
            value: (
              <Link
                href={`/dashboard/psc/${row.pscInspectionId}`}
                className="text-[var(--accent)] hover:underline"
              >
                View linked inspection
              </Link>
            ),
          },
        ]
      : []),
    {
      label: "Status",
      value: (
        <StatusPill tone={deficiencyStatusTone(row.status)}>
          {deficiencyStatusLabel(row.status)}
        </StatusPill>
      ),
    },
    { label: "Reference", value: row.reference ?? "—" },
    { label: "Identified", value: row.identifiedDate ?? "—" },
    { label: "Due", value: row.dueDate ?? "—" },
    { label: "Closed", value: row.closedDate ?? "—" },
    { label: "Responsible", value: row.responsiblePerson ?? "—" },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/deficiencies"
            className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
          >
            ← Back to deficiencies
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {row.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            <Identifier>{row.vesselName}</Identifier>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/deficiencies/${row.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
          >
            Edit
          </Link>
          <ConfirmDeleteButton
            id={row.id}
            title="Delete deficiency?"
            description="This permanently removes the deficiency and its attachments."
            action={deleteDeficiencyFormAction}
          />
        </div>
      </div>

      <section className="mt-6 flex flex-wrap gap-2">
        {row.status !== "in_progress" ? (
          <form action={startProgressDeficiencyFormAction}>
            <input type="hidden" name="id" value={row.id} />
            <Button variant="secondary" type="submit">
              Start progress
            </Button>
          </form>
        ) : null}
        {row.status !== "monitoring" ? (
          <form action={setMonitoringDeficiencyFormAction}>
            <input type="hidden" name="id" value={row.id} />
            <Button variant="secondary" type="submit">
              Set monitoring
            </Button>
          </form>
        ) : null}
        {row.status !== "closed" ? (
          <form action={closeDeficiencyFormAction}>
            <input type="hidden" name="id" value={row.id} />
            <Button variant="secondary" type="submit">
              Close
            </Button>
          </form>
        ) : (
          <form action={reopenDeficiencyFormAction}>
            <input type="hidden" name="id" value={row.id} />
            <Button variant="secondary" type="submit">
              Reopen
            </Button>
          </form>
        )}
      </section>

      <dl className="mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div
            key={f.label}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {f.label}
            </dt>
            <dd className="mt-1 text-sm text-[var(--text-primary)]">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      {row.description ? (
        <section className="mt-8 max-w-4xl">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Description
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {row.description}
          </p>
        </section>
      ) : null}

      {row.correctiveAction ? (
        <section className="mt-6 max-w-4xl">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Corrective action
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {row.correctiveAction}
          </p>
        </section>
      ) : null}

      {row.notes ? (
        <section className="mt-6 max-w-4xl">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {row.notes}
          </p>
        </section>
      ) : null}

      <section className="mt-10 max-w-4xl space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Attachments
        </h2>
        <DeficiencyAttachments
          deficiencyId={row.id}
          attachments={row.attachments}
        />
      </section>
    </main>
  );
}
