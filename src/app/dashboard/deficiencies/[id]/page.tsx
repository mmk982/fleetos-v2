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

const transitionBtn =
  "inline-flex h-9 items-center rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

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
    { label: "Source", value: deficiencySourceLabel(row.source) },
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
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            ← Back to deficiencies
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {row.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <Identifier>{row.vesselName}</Identifier>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/deficiencies/${row.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
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
            <button type="submit" className={transitionBtn}>
              Start progress
            </button>
          </form>
        ) : null}
        {row.status !== "monitoring" ? (
          <form action={setMonitoringDeficiencyFormAction}>
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" className={transitionBtn}>
              Set monitoring
            </button>
          </form>
        ) : null}
        {row.status !== "closed" ? (
          <form action={closeDeficiencyFormAction}>
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" className={transitionBtn}>
              Close
            </button>
          </form>
        ) : (
          <form action={reopenDeficiencyFormAction}>
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" className={transitionBtn}>
              Reopen
            </button>
          </form>
        )}
      </section>

      <dl className="mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div
            key={f.label}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {f.label}
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      {row.description ? (
        <section className="mt-8 max-w-4xl">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Description
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {row.description}
          </p>
        </section>
      ) : null}

      {row.correctiveAction ? (
        <section className="mt-6 max-w-4xl">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Corrective action
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {row.correctiveAction}
          </p>
        </section>
      ) : null}

      {row.notes ? (
        <section className="mt-6 max-w-4xl">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {row.notes}
          </p>
        </section>
      ) : null}

      <section className="mt-10 max-w-4xl space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
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
