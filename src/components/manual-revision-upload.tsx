"use client";

import { Button } from "@/components/ui/button";
import { useActionState, useEffect } from "react";
import {
  addManualRevisionAction,
  type ManualActionState,
} from "@/modules/manuals/actions";

const labelClass =
  "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";

type Props = {
  manualId: string;
  onSuccess?: () => void;
};

export function ManualRevisionUpload({ manualId, onSuccess }: Props) {
  const [state, formAction, pending] = useActionState(
    addManualRevisionAction,
    undefined as ManualActionState | undefined,
  );

  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="manualId" value={manualId} />
      {state && !state.ok ? (
        <div
          className="rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <label htmlFor="revisionNumber" className={labelClass}>
          Revision number
        </label>
        <input
          id="revisionNumber"
          name="revisionNumber"
          className={inputClass}
          placeholder="e.g. Rev. 2"
        />
      </div>

      <div>
        <label htmlFor="revisionDate" className={labelClass}>
          Revision date
        </label>
        <input
          id="revisionDate"
          name="revisionDate"
          type="date"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="file" className={labelClass}>
          File <span className="text-red-600">*</span>
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,image/jpeg,image/png,application/pdf"
          required
          className={inputClass}
        />
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          PDF, JPEG, or PNG — max 10 MB. Becomes the current version.
        </p>
      </div>

      <Button variant="primary" type="submit"
        disabled={pending}>
        {pending ? "Uploading…" : "Upload revision"}
      </Button>
    </form>
  );
}
