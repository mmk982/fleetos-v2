"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import {
  setCriticalDaysAction,
  type SettingsActionState,
} from "@/modules/settings/actions";

const labelClass =
  "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full max-w-xs rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";

export function CriticalDaysForm({
  initialValue,
}: {
  initialValue: number;
}) {
  const [state, formAction, pending] = useActionState(
    setCriticalDaysAction as (
      prev: SettingsActionState | undefined,
      formData: FormData,
    ) => Promise<SettingsActionState>,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200">
          {state.message ?? "Saved."}
        </div>
      ) : null}

      <div>
        <label htmlFor="criticalDays" className={labelClass}>
          Critical days
        </label>
        <p className="mb-2 text-sm text-[var(--text-tertiary)]">
          Days before expiry when status flips to Critical (default 7). Per-item
          reminder offsets live on certificate types, not here.
        </p>
        <input
          id="criticalDays"
          name="criticalDays"
          type="number"
          min={1}
          max={365}
          required
          defaultValue={initialValue}
          className={inputClass}
        />
        {state && !state.ok && state.fieldErrors?.criticalDays ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {state.fieldErrors.criticalDays.join(" ")}
          </p>
        ) : null}
      </div>

      <Button variant="primary" type="submit"
        disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
