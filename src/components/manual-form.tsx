"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createManualAction,
  updateManualAction,
  type ManualActionState,
} from "@/modules/manuals/actions";
import type { ManualRow, VesselRow } from "@/db/schema";

const labelClass =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type Props = {
  vessels: VesselRow[];
  onCancelHref?: string;
} & (
  | { mode: "create" }
  | { mode: "edit"; manualId: string; defaultValues: ManualRow }
);

export function ManualForm(props: Props) {
  const action =
    props.mode === "create"
      ? createManualAction
      : updateManualAction.bind(null, props.manualId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: ManualActionState | undefined,
      formData: FormData,
    ) => Promise<ManualActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const cancelHref =
    props.onCancelHref ??
    (props.mode === "create"
      ? "/dashboard/manuals"
      : `/dashboard/manuals/${props.manualId}`);

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
          Saved.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="vesselId" className={labelClass}>
            Vessel <span className="text-red-600">*</span>
          </label>
          <select
            id="vesselId"
            name="vesselId"
            required
            defaultValue={d?.vesselId ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Select vessel
            </option>
            {props.vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {fieldErrors?.vesselId ? (
            <p className={errorText}>{fieldErrors.vesselId.join(" ")}</p>
          ) : null}
        </div>

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
          <label htmlFor="manualType" className={labelClass}>
            Manual type
          </label>
          <input
            id="manualType"
            name="manualType"
            defaultValue={d?.manualType ?? ""}
            className={inputClass}
            placeholder="e.g. SMS, SOPEP"
          />
        </div>

        <div>
          <label htmlFor="department" className={labelClass}>
            Department
          </label>
          <input
            id="department"
            name="department"
            defaultValue={d?.department ?? ""}
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

        {props.mode === "create" ? (
          <>
            <div>
              <label htmlFor="revisionNumber" className={labelClass}>
                First revision number
              </label>
              <input
                id="revisionNumber"
                name="revisionNumber"
                className={inputClass}
                placeholder="e.g. Rev. 1"
              />
            </div>
            <div>
              <label htmlFor="revisionDate" className={labelClass}>
                First revision date
              </label>
              <input
                id="revisionDate"
                name="revisionDate"
                type="date"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="file" className={labelClass}>
                First revision file <span className="text-red-600">*</span>
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".pdf,image/jpeg,image/png,application/pdf"
                required
                className={inputClass}
              />
              <p className="mt-1 text-xs text-zinc-500">
                PDF, JPEG, or PNG — max 10 MB.
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : props.mode === "create"
              ? "Add manual"
              : "Save changes"}
        </button>
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
