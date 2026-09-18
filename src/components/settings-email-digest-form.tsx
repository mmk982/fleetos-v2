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

      <div className="flex items-start gap-3">
        <input
          id="emailDigestEnabled"
          name="enabled"
          type="checkbox"
          value="true"
          defaultChecked={initialEnabled}
          className="mt-1 h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
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
