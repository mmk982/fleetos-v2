"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState } from "react";
import {
  createDrawingAction,
  updateDrawingAction,
  type DrawingActionState,
} from "@/modules/drawings/actions";
import type {
  DrawingCategoryRow,
  DrawingRow,
  VesselRow,
} from "@/db/schema";

const labelClass =
  "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type Props = {
  vessels: VesselRow[];
  categories: DrawingCategoryRow[];
  onCancelHref?: string;
} & (
  | { mode: "create" }
  | { mode: "edit"; drawingId: string; defaultValues: DrawingRow }
);

export function DrawingForm(props: Props) {
  const action =
    props.mode === "create"
      ? createDrawingAction
      : updateDrawingAction.bind(null, props.drawingId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: DrawingActionState | undefined,
      formData: FormData,
    ) => Promise<DrawingActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const cancelHref =
    props.onCancelHref ??
    (props.mode === "create"
      ? "/dashboard/drawings"
      : `/dashboard/drawings/${props.drawingId}`);

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
          <label htmlFor="categoryId" className={labelClass}>
            Category <span className="text-red-600">*</span>
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={d?.categoryId ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Select category
            </option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldErrors?.categoryId ? (
            <p className={errorText}>{fieldErrors.categoryId.join(" ")}</p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="drawingName" className={labelClass}>
            Drawing name <span className="text-red-600">*</span>
          </label>
          <input
            id="drawingName"
            name="drawingName"
            required
            defaultValue={d?.drawingName ?? ""}
            className={inputClass}
          />
          {fieldErrors?.drawingName ? (
            <p className={errorText}>{fieldErrors.drawingName.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="drawingNumber" className={labelClass}>
            Drawing number
          </label>
          <input
            id="drawingNumber"
            name="drawingNumber"
            defaultValue={d?.drawingNumber ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="revision" className={labelClass}>
            Revision
          </label>
          <input
            id="revision"
            name="revision"
            defaultValue={d?.revision ?? ""}
            className={inputClass}
            placeholder="e.g. Rev A"
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
              ? "Add drawing"
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
