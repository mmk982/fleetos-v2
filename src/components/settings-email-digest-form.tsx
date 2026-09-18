"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import {
  setEmailDigestEnabledAction,
  type SettingsActionState,
} from "@/modules/settings/actions";

export function EmailDigestForm({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    setEmailDigestEnabledAction as (
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

      <div className="flex items-start gap-3">
        <input
          id="emailDigestEnabled"
          name="enabled"
          type="checkbox"
          value="true"
          defaultChecked={initialEnabled}
          className="mt-1 h-4 w-4 rounded border-[var(--border)] text-[#378ADD] focus:ring-[#378ADD]"
        />
        <div>
          <label
            htmlFor="emailDigestEnabled"
            className="text-sm font-medium text-[var(--text-secondary)]"
          >
            Daily email digest
          </label>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            When enabled, all active Admin users receive one daily email of
            actionable compliance alerts (same signal as the Alerts page).
          </p>
        </div>
      </div>

      <Button variant="primary" type="submit"
        disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
