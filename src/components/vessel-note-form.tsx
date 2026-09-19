"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import {
  createVesselNoteAction,
  type ParticularsActionState,
} from "@/modules/ship-particulars/actions";

const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";

export function VesselNoteForm({ vesselId }: { vesselId: string }) {
  const [state, formAction, pending] = useActionState(
    createVesselNoteAction as (
      prev: ParticularsActionState | undefined,
      formData: FormData,
    ) => Promise<ParticularsActionState>,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />
      {state && !state.ok ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200">
          {state.message ?? "Note added."}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
          Add note
        </span>
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Write a note…"
          className={inputClass}
        />
      </label>
      <Button variant="primary" type="submit"
        disabled={pending}>
        {pending ? "Saving…" : "Add note"}
      </Button>
    </form>
  );
}
