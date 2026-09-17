"use client";

import { useActionState } from "react";
import { Identifier } from "@/components/ui/identifier";
import {
  deleteParticularsAttachmentAction,
  uploadParticularsAttachmentAction,
  type ParticularsActionState,
} from "@/modules/ship-particulars/actions";
import type { VesselParticularsAttachmentRow } from "@/db/schema";

const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";

export function ParticularsAttachments({
  particularsId,
  vesselId,
  attachments,
}: {
  particularsId: string;
  vesselId: string;
  attachments: VesselParticularsAttachmentRow[];
}) {
  const [state, formAction, pending] = useActionState(
    uploadParticularsAttachmentAction,
    undefined as ParticularsActionState | undefined,
  );

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
        {attachments.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
            No attachments yet.
          </li>
        ) : (
          attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <a
                href={`/api/attachments/${a.id}`}
                className="font-medium text-[#378ADD] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                <Identifier>{a.fileName}</Identifier>
              </a>
              <form action={deleteParticularsAttachmentAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="vesselId" value={vesselId} />
                <button
                  type="submit"
                  className="text-xs font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-300"
                >
                  Remove
                </button>
              </form>
            </li>
          ))
        )}
      </ul>

      <form
        action={formAction}
        className="space-y-3 rounded-lg border border-dashed border-[var(--border)] p-4"
      >
        <input type="hidden" name="particularsId" value={particularsId} />
        <input type="hidden" name="vesselId" value={vesselId} />
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Upload attachment
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">PDF, JPEG, or PNG — max 10 MB.</p>
        {state && !state.ok ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            {state.message ?? "Uploaded."}
          </p>
        ) : null}
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,image/jpeg,image/png,application/pdf"
          required
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );
}
