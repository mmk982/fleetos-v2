import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ManualRevisionHistory } from "@/components/manual-revision-history";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import { deleteManualFormAction } from "@/modules/manuals/actions";
import { getManualById } from "@/modules/manuals/manual.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function ManualDetailPage(props: PageProps) {
  const session = await requireSession();
  const { id } = await props.params;
  const row = await getManualById(toAccessContext(session), id);
  if (!row) notFound();

  const fields: { label: string; value: ReactNode }[] = [
    {
      label: "Vessel",
      value: <Identifier>{row.vesselName}</Identifier>,
    },
    { label: "Type", value: row.manualType ?? "—" },
    { label: "Department", value: row.department ?? "—" },
    {
      label: "Current revision",
      value: row.currentRevision ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>
            {row.currentRevision.revisionNumber ?? "—"}
            {row.currentRevision.revisionDate
              ? ` · ${row.currentRevision.revisionDate}`
              : ""}
          </span>
          <StatusPill tone="success">Current</StatusPill>
        </span>
      ) : (
        "—"
      ),
    },
    { label: "Revisions", value: String(row.revisionCount) },
    { label: "Notes", value: row.notes ?? "—" },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/manuals"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            ← Back to manuals
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
            href={`/dashboard/manuals/${row.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-none bg-[#378ADD] px-4 text-sm font-medium text-white"
          >
            Edit
          </Link>
          <ConfirmDeleteButton
            id={row.id}
            title="Delete manual?"
            description="This permanently removes the manual and all revision files."
            action={deleteManualFormAction}
          />
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {f.label}
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <ManualRevisionHistory
          manualId={row.id}
          revisions={row.revisions}
        />
      </section>
    </main>
  );
}
