"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState } from "react";
import {
  createPscInspectionAction,
  updatePscInspectionAction,
  type PscInspectionActionState,
} from "@/modules/psc/actions";
import {
  PSC_INSPECTION_RESULTS,
  pscInspectionResultLabel,
  type PscInspectionListItem,
} from "@/modules/psc/psc.model";
import type { VesselRow } from "@/db/schema";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";
const errorText = "mt-1 text-sm text-[var(--error)]";

type PscInspectionFormProps = {
  vessels: VesselRow[];
  onCancelHref?: string;
} & (
  | { mode: "create" }
  | {
      mode: "edit";
      inspectionId: string;
      defaultValues: PscInspectionListItem;
    }
);

export function PscInspectionForm(props: PscInspectionFormProps) {
  const action =
    props.mode === "create"
      ? createPscInspectionAction
      : updatePscInspectionAction.bind(null, props.inspectionId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: PscInspectionActionState | undefined,
      formData: FormData,
    ) => Promise<PscInspectionActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const cancelHref =
    props.onCancelHref ??
    (props.mode === "create"
      ? "/dashboard/psc"
      : `/dashboard/psc/${props.inspectionId}`);

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok ? (
        <div
          className="rounded-md border border-[color-mix(in_oklab,var(--error)_25%,white)] bg-[color-mix(in_oklab,var(--error)_10%,white)] px-3 py-2 text-sm text-[var(--error)] dark:border-[var(--error)]/40 dark:bg-[var(--error)]/20"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="vesselId" className={labelClass}>
            Vessel <span className="text-[var(--error)]">*</span>
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

        <div>
          <label htmlFor="port" className={labelClass}>
            Port <span className="text-[var(--error)]">*</span>
          </label>
          <input
            id="port"
            name="port"
            required
            maxLength={200}
            defaultValue={d?.port ?? ""}
            className={inputClass}
            autoComplete="off"
          />
          {fieldErrors?.port ? (
            <p className={errorText}>{fieldErrors.port.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="inspectionDate" className={labelClass}>
            Inspection date <span className="text-[var(--error)]">*</span>
          </label>
          <input
            id="inspectionDate"
            name="inspectionDate"
            type="date"
            required
            defaultValue={d?.inspectionDate ?? ""}
            className={inputClass}
          />
          {fieldErrors?.inspectionDate ? (
            <p className={errorText}>{fieldErrors.inspectionDate.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="authority" className={labelClass}>
            Authority <span className="text-[var(--error)]">*</span>
          </label>
          <input
            id="authority"
            name="authority"
            required
            maxLength={200}
            defaultValue={d?.authority ?? ""}
            className={inputClass}
            autoComplete="off"
          />
          {fieldErrors?.authority ? (
            <p className={errorText}>{fieldErrors.authority.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="result" className={labelClass}>
            Result <span className="text-[var(--error)]">*</span>
          </label>
          <select
            id="result"
            name="result"
            required
            defaultValue={d?.result ?? "no_deficiencies"}
            className={inputClass}
          >
            {PSC_INSPECTION_RESULTS.map((r) => (
              <option key={r} value={r}>
                {pscInspectionResultLabel(r)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 pb-2">
          <input
            id="detained"
            name="detained"
            type="checkbox"
            value="true"
            defaultChecked={d?.detained ?? false}
            className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <label htmlFor="detained" className="text-sm text-[var(--text-secondary)]">
            Vessel detained
          </label>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="inspectorName" className={labelClass}>
            Inspector name
          </label>
          <input
            id="inspectorName"
            name="inspectorName"
            defaultValue={d?.inspectorName ?? ""}
            className={inputClass}
            autoComplete="off"
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

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
        <Button variant="primary" type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : props.mode === "create"
              ? "Create inspection"
              : "Save changes"}
        </Button>
        <Link
          href={cancelHref}
          className="text-sm font-medium text-[var(--text-secondary)] underline-offset-4 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
