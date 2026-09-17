"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Identifier } from "@/components/ui/identifier";
import {
  createVesselAction,
  updateVesselAction,
  type VesselActionState,
} from "@/modules/vessels/actions";
import { VESSEL_STATUSES } from "@/modules/vessels/vessel.model";
import type { VesselRow } from "@/db/schema";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[#0D2B45]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type VesselFormProps =
  | { mode: "create" }
  | { mode: "edit"; vesselId: string; defaultValues: VesselRow };

export function VesselForm(props: VesselFormProps) {
  const action =
    props.mode === "create"
      ? createVesselAction
      : updateVesselAction.bind(null, props.vesselId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: VesselActionState | undefined,
      formData: FormData,
    ) => Promise<VesselActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-6">
      {state && !state.ok ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className={labelClass}>
            Vessel name <span className="text-red-600">*</span>
          </label>
          <Identifier>
            <input
              id="name"
              name="name"
              required
              maxLength={200}
              defaultValue={d?.name ?? ""}
              className={inputClass}
              autoComplete="off"
            />
          </Identifier>
          {fieldErrors?.name ? (
            <p className={errorText}>{fieldErrors.name.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="imoNumber" className={labelClass}>
            IMO number
          </label>
          <Identifier>
            <input
              id="imoNumber"
              name="imoNumber"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="7 digits"
              defaultValue={d?.imoNumber ?? ""}
              className={inputClass}
              autoComplete="off"
            />
          </Identifier>
          {fieldErrors?.imoNumber ? (
            <p className={errorText}>{fieldErrors.imoNumber.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="mmsi" className={labelClass}>
            MMSI
          </label>
          <input
            id="mmsi"
            name="mmsi"
            maxLength={15}
            defaultValue={d?.mmsi ?? ""}
            className={inputClass}
            autoComplete="off"
          />
          {fieldErrors?.mmsi ? (
            <p className={errorText}>{fieldErrors.mmsi.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="callSign" className={labelClass}>
            Call sign
          </label>
          <input
            id="callSign"
            name="callSign"
            maxLength={32}
            defaultValue={d?.callSign ?? ""}
            className={inputClass}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="flagState" className={labelClass}>
            Flag state
          </label>
          <input
            id="flagState"
            name="flagState"
            maxLength={120}
            defaultValue={d?.flagState ?? ""}
            className={inputClass}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="vesselType" className={labelClass}>
            Vessel type
          </label>
          <input
            id="vesselType"
            name="vesselType"
            maxLength={120}
            placeholder="e.g. Bulk carrier"
            defaultValue={d?.vesselType ?? ""}
            className={inputClass}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="grossTonnage" className={labelClass}>
            Gross tonnage
          </label>
          <input
            id="grossTonnage"
            name="grossTonnage"
            inputMode="numeric"
            defaultValue={d?.grossTonnage ?? ""}
            className={inputClass}
            autoComplete="off"
          />
          {fieldErrors?.grossTonnage ? (
            <p className={errorText}>{fieldErrors.grossTonnage.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="yearBuilt" className={labelClass}>
            Year built
          </label>
          <input
            id="yearBuilt"
            name="yearBuilt"
            inputMode="numeric"
            defaultValue={d?.yearBuilt ?? ""}
            className={inputClass}
            autoComplete="off"
          />
          {fieldErrors?.yearBuilt ? (
            <p className={errorText}>{fieldErrors.yearBuilt.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={d?.status ?? "active"}
            className={inputClass}
          >
            {VESSEL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          {fieldErrors?.status ? (
            <p className={errorText}>{fieldErrors.status.join(" ")}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={d?.notes ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-6">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#0D2B45] px-4 text-sm font-medium text-white transition-opacity disabled:opacity-60"
        >
          {pending ? "Saving…" : props.mode === "create" ? "Create vessel" : "Save changes"}
        </button>
        <Link
          href={props.mode === "create" ? "/dashboard/vessels" : `/dashboard/vessels/${props.vesselId}`}
          className="text-sm font-medium text-[var(--text-secondary)] underline-offset-4 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
