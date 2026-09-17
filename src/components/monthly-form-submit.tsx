"use client";

import { useActionState, useEffect } from "react";
import {
  submitMonthlyFormAction,
  type MonthlyFormActionState,
} from "@/modules/monthly-forms/actions";

const labelClass =
  "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";

type Props = {
  executedFormId: string;
  onSuccess?: () => void;
};

export function MonthlyFormSubmit({ executedFormId, onSuccess }: Props) {
  const [state, formAction, pending] = useActionState(
    submitMonthlyFormAction,
    undefined as MonthlyFormActionState | undefined,
  );

  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="executedFormId" value={executedFormId} />
      {state && !state.ok ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <label htmlFor="remarks" className={labelClass}>
          Remarks
        </label>
        <textarea
          id="remarks"
          name="remarks"
          rows={3}
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
          PDF, JPEG, or PNG — max 10 MB.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit form"}
      </button>
    </form>
  );
}
