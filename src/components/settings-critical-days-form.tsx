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
  "w-full max-w-xs rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";

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
          className="rounded-md border border-[color-mix(in_oklab,var(--error)_25%,white)] bg-[color-mix(in_oklab,var(--error)_10%,white)] px-3 py-2 text-sm text-[var(--error)] dark:border-[var(--error)]/40 dark:bg-[var(--error)]/20"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="rounded-md border border-[color-mix(in_oklab,var(--success)_25%,white)] bg-[color-mix(in_oklab,var(--success)_10%,white)] px-3 py-2 text-sm text-[var(--success)] dark:border-[var(--success)]/40 dark:bg-[var(--success)]/20">
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
          <p className="mt-1 text-sm text-[var(--error)]">
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
