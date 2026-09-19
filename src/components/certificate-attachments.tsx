"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import {
  deleteCertificateAttachmentAction,
  uploadCertificateAttachmentAction,
  type CertificateActionState,
} from "@/modules/certificates/actions";
import type { CertificateAttachmentRow } from "@/db/schema";
import { Identifier } from "@/components/ui/identifier";

const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";

type Props = {
  certificateId: string;
  attachments: CertificateAttachmentRow[];
};

export function CertificateAttachments({ certificateId, attachments }: Props) {
  const [state, formAction, pending] = useActionState(
    uploadCertificateAttachmentAction,
    undefined as CertificateActionState | undefined,
  );

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {attachments.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">No attachments yet.</li>
        ) : (
          attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <a
                href={`/api/attachments/${a.id}`}
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                <Identifier>{a.fileName}</Identifier>
              </a>
              <form action={deleteCertificateAttachmentAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="certificateId" value={certificateId} />
                <Button variant="destructive" size="sm" type="submit">
                  Remove
                </Button>
              </form>
            </li>
          ))
        )}
      </ul>

      <form action={formAction} className="space-y-3 rounded-xl border border-dashed border-[var(--border)] p-4">
        <input type="hidden" name="certificateId" value={certificateId} />
        <p className="text-sm font-medium text-[var(--text-primary)]">Upload attachment</p>
        <p className="text-xs text-[var(--text-tertiary)]">PDF, JPEG, or PNG — max 10 MB.</p>
        {state && !state.ok ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="text-sm text-green-700 dark:text-green-400">Uploaded.</p>
        ) : null}
        <input id="file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required className={inputClass} />
        <Button variant="primary" type="submit"
          disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </form>
    </div>
  );
}
