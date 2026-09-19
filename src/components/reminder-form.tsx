"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState } from "react";
import {
  createReminderAction,
  updateReminderAction,
  type ReminderActionState,
} from "@/modules/reminders/actions";
import {
  REMINDER_PRIORITIES,
  REMINDER_STATUSES,
  REMINDER_TYPES,
  reminderPriorityLabel,
  reminderStatusLabel,
  reminderTypeLabel,
} from "@/modules/reminders/reminder.model";
import type { ReminderRow, VesselRow } from "@/db/schema";

const labelClass =
  "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type Props = {
  vessels: VesselRow[];
  onCancelHref?: string;
} & (
  | { mode: "create" }
  | { mode: "edit"; reminderId: string; defaultValues: ReminderRow }
);

export function ReminderForm(props: Props) {
  const action =
    props.mode === "create"
      ? createReminderAction
      : updateReminderAction.bind(null, props.reminderId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: ReminderActionState | undefined,
      formData: FormData,
    ) => Promise<ReminderActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const cancelHref = props.onCancelHref ?? "/dashboard/reminders";

  return (
    <form action={formAction} className="space-y-5">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className={labelClass}>
            Title <span className="text-red-600">*</span>
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={d?.title ?? ""}
            className={inputClass}
          />
          {fieldErrors?.title ? (
            <p className={errorText}>{fieldErrors.title.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="type" className={labelClass}>
            Type <span className="text-red-600">*</span>
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue={d?.type ?? "custom"}
            className={inputClass}
          >
            {REMINDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {reminderTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className={labelClass}>
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={d?.priority ?? "medium"}
            className={inputClass}
          >
            {REMINDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {reminderPriorityLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="reminderDate" className={labelClass}>
            Reminder date <span className="text-red-600">*</span>
          </label>
          <input
            id="reminderDate"
            name="reminderDate"
            type="date"
            required
            defaultValue={d?.reminderDate ?? ""}
            className={inputClass}
          />
          {fieldErrors?.reminderDate ? (
            <p className={errorText}>{fieldErrors.reminderDate.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="vesselId" className={labelClass}>
            Vessel (optional)
          </label>
          <select
            id="vesselId"
            name="vesselId"
            defaultValue={d?.vesselId ?? ""}
            className={inputClass}
          >
            <option value="">Fleet-wide</option>
            {props.vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {props.mode === "edit" ? (
          <div>
            <label htmlFor="status" className={labelClass}>
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={d?.status ?? "pending"}
              className={inputClass}
            >
              {REMINDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {reminderStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="relatedItemKind" className={labelClass}>
            Related item kind
          </label>
          <input
            id="relatedItemKind"
            name="relatedItemKind"
            defaultValue={d?.relatedItemKind ?? ""}
            placeholder="e.g. certificate"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="relatedItemId" className={labelClass}>
            Related item id
          </label>
          <input
            id="relatedItemId"
            name="relatedItemId"
            defaultValue={d?.relatedItemId ?? ""}
            placeholder="UUID (optional)"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={d?.notes ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" type="submit"
          disabled={pending}>
          {pending
            ? "Saving…"
            : props.mode === "create"
              ? "Add reminder"
              : "Save changes"}
        </Button>
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-secondary)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
