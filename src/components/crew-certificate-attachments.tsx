"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import { Identifier } from "@/components/ui/identifier";
import {
  deleteCrewCertificateAttachmentAction,
  uploadCrewCertificateAttachmentAction,
  type CrewActionState,
} from "@/modules/crew/actions";
import type { CrewCertificateAttachmentRow } from "@/db/schema";

const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";

type Props = {
  crewMemberId: string;
  crewCertificateId: string;
  attachments: CrewCertificateAttachmentRow[];
};

export function CrewCertificateAttachments({
  crewMemberId,
  crewCertificateId,
  attachments,
}: Props) {
  const [state, formAction, pending] = useActionState(
    uploadCrewCertificateAttachmentAction,
    undefined as CrewActionState | undefined,
  );

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
        Attachments
      </p>
      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {attachments.length === 0 ? (
          <li className="px-3 py-3 text-center text-xs text-[var(--text-tertiary)]">
            No files yet.
          </li>
        ) : (
          attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <a
                href={`/api/attachments/${a.id}`}
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                <Identifier>{a.fileName}</Identifier>
              </a>
              <form action={deleteCrewCertificateAttachmentAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="crewMemberId" value={crewMemberId} />
                <Button variant="destructive" size="sm" type="submit">
                  Remove
                </Button>
              </form>
            </li>
          ))
        )}
      </ul>

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="crewCertificateId" value={crewCertificateId} />
        <input type="hidden" name="crewMemberId" value={crewMemberId} />
        {state && !state.ok ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <input
            id={`file-${crewCertificateId}`}
            name="file"
            type="file"
            accept=".pdf,image/jpeg,image/png,application/pdf"
            required
            className={`${inputClass} max-w-xs`}
          />
          <Button variant="secondary" type="submit"
            disabled={pending}>
            {pending ? "Uploading…" : "Upload"}
          </Button>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">PDF, JPEG, or PNG — max 10 MB.</p>
      </form>
    </div>
  );
}
