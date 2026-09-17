"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState } from "react";
import {
  createParticularsAction,
  updateParticularsAction,
  type ParticularsActionState,
} from "@/modules/ship-particulars/actions";
import type { VesselParticularsRow, VesselRow } from "@/db/schema";

const labelClass =
  "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type Props = {
  vessels: VesselRow[];
  fixedVesselId?: string;
  onCancelHref?: string;
} & (
  | { mode: "create"; makeCurrent?: boolean }
  | {
      mode: "edit";
      particularsId: string;
      defaultValues: VesselParticularsRow;
    }
);

export function ParticularsForm(props: Props) {
  const action =
    props.mode === "create"
      ? createParticularsAction
      : updateParticularsAction.bind(null, props.particularsId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: ParticularsActionState | undefined,
      formData: FormData,
    ) => Promise<ParticularsActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const vesselId =
    props.fixedVesselId ??
    (props.mode === "edit" ? props.defaultValues.vesselId : "");
  const cancelHref =
    props.onCancelHref ??
    (vesselId
      ? `/dashboard/particulars/${vesselId}`
      : "/dashboard/particulars");

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok ? (
        <div
          className="rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="rounded-none border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200">
          {state.message ?? "Saved."}
        </div>
      ) : null}

      {props.fixedVesselId ? (
        <input type="hidden" name="vesselId" value={props.fixedVesselId} />
      ) : (
        <div>
          <label htmlFor="vesselId" className={labelClass}>
            Vessel <span className="text-red-600">*</span>
          </label>
          <select
            id="vesselId"
            name="vesselId"
            required
            defaultValue={vesselId}
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
      )}

      {props.mode === "create" ? (
        <input
          type="hidden"
          name="isCurrent"
          value={props.makeCurrent === false ? "false" : "true"}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["classSociety", "Class society"],
            ["portOfRegistry", "Port of registry"],
            ["owner", "Owner"],
            ["manager", "Manager"],
            ["mainEngine", "Main engine"],
            ["auxEngines", "Aux engines"],
          ] as const
        ).map(([name, label]) => (
          <div key={name}>
            <label htmlFor={name} className={labelClass}>
              {label}
            </label>
            <input
              id={name}
              name={name}
              defaultValue={(d?.[name] as string | null) ?? ""}
              className={inputClass}
            />
          </div>
        ))}

        {(
          [
            ["deadweightTonnage", "DWT"],
            ["netRegisteredTonnage", "NRT"],
            ["lengthOverall", "LOA (m)"],
            ["breadth", "Breadth (m)"],
            ["depth", "Depth (m)"],
            ["draft", "Draft (m)"],
            ["cargoCapacity", "Cargo capacity"],
            ["ballastCapacity", "Ballast capacity"],
            ["fuelOilCapacity", "Fuel oil capacity"],
            ["freshWaterCapacity", "Fresh water capacity"],
          ] as const
        ).map(([name, label]) => (
          <div key={name}>
            <label htmlFor={name} className={labelClass}>
              {label}
            </label>
            <input
              id={name}
              name={name}
              type="number"
              step="any"
              min={0}
              defaultValue={
                d?.[name] != null && d[name] !== ""
                  ? String(d[name])
                  : ""
              }
              className={inputClass}
            />
            {fieldErrors?.[name] ? (
              <p className={errorText}>{fieldErrors[name]!.join(" ")}</p>
            ) : null}
          </div>
        ))}

        <div>
          <label htmlFor="effectiveDate" className={labelClass}>
            Effective date
          </label>
          <input
            id="effectiveDate"
            name="effectiveDate"
            type="date"
            defaultValue={d?.effectiveDate ?? ""}
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
              ? "Save as current"
              : "Save changes"}
        </Button>
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-none border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-secondary)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
