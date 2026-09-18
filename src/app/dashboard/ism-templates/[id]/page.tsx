import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { IsmTemplateAttachments } from "@/components/ism-template-attachments";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import { deleteIsmTemplateFormAction } from "@/modules/ism-templates/actions";
import { getIsmTemplateById } from "@/modules/ism-templates/ismTemplate.controller";
import {
  ismTemplateStatusLabel,
  ismTemplateStatusTone,
} from "@/modules/ism-templates/ismTemplate.model";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function IsmTemplateDetailPage(props: PageProps) {
  const session = await requireSession();
  const { id } = await props.params;
  const row = await getIsmTemplateById(toAccessContext(session), id);
  if (!row) notFound();

  const fields: { label: string; value: ReactNode }[] = [
    {
      label: "Form code",
      value: (
        <span className="font-mono text-sm">
          <Identifier>{row.formCode}</Identifier>
        </span>
      ),
    },
    { label: "Category", value: row.categoryName },
    {
      label: "Status",
      value: (
        <StatusPill tone={ismTemplateStatusTone(row.status)}>
          {ismTemplateStatusLabel(row.status)}
        </StatusPill>
      ),
    },
    { label: "Revision", value: row.revision ?? "—" },
  ];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/ism-templates"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            ← Back to ISM templates
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {row.formName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <Identifier>{row.formCode}</Identifier>
            {` · ${row.categoryName}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/ism-templates/${row.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
          >
            Edit
          </Link>
          <ConfirmDeleteButton
            id={row.id}
            title="Delete ISM template?"
            description="This permanently removes the template and its attachments."
            action={deleteIsmTemplateFormAction}
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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Attachments
        </h2>
        <div className="mt-4">
          <IsmTemplateAttachments
            ismTemplateId={row.id}
            attachments={row.attachments}
          />
        </div>
      </section>
    </main>
  );
}
