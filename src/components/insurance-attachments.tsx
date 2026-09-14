"use client";

import { useActionState } from "react";
import { Identifier } from "@/components/ui/identifier";
import {
  deleteInsuranceAttachmentAction,
  uploadInsuranceAttachmentAction,
  type InsuranceActionState,
} from "@/modules/insurance/actions";
import type { InsuranceAttachmentRow } from "@/db/schema";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

type Props = {
  insurancePolicyId: string;
  attachments: InsuranceAttachmentRow[];
};

export function InsuranceAttachments({
  insurancePolicyId,
  attachments,
}: Props) {
  const [state, formAction, pending] = useActionState(
    uploadInsuranceAttachmentAction,
    undefined as InsuranceActionState | undefined,
  );

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {attachments.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">
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
              <form action={deleteInsuranceAttachmentAction}>
                <input type="hidden" name="id" value={a.id} />
                <input
                  type="hidden"
                  name="insurancePolicyId"
                  value={insurancePolicyId}
                />
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
        className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
      >
        <input
          type="hidden"
          name="insurancePolicyId"
          value={insurancePolicyId}
        />
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Upload attachment
        </p>
        <p className="text-xs text-zinc-500">PDF, JPEG, or PNG — max 10 MB.</p>
        {state && !state.ok ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="text-sm text-green-700 dark:text-green-400">Uploaded.</p>
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
