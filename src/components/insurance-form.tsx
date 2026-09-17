"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState } from "react";
import {
  createInsurancePolicyAction,
  updateInsurancePolicyAction,
  type InsuranceActionState,
} from "@/modules/insurance/actions";
import {
  INSURANCE_TYPES,
  insuranceTypeLabel,
} from "@/modules/insurance/insurance.model";
import type { InsurancePolicyRow, VesselRow } from "@/db/schema";
import { Identifier } from "@/components/ui/identifier";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type Props = {
  vessels: VesselRow[];
  onCancelHref?: string;
} & (
  | { mode: "create" }
  | { mode: "edit"; policyId: string; defaultValues: InsurancePolicyRow }
);

export function InsuranceForm(props: Props) {
  const action =
    props.mode === "create"
      ? createInsurancePolicyAction
      : updateInsurancePolicyAction.bind(null, props.policyId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: InsuranceActionState | undefined,
      formData: FormData,
    ) => Promise<InsuranceActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const cancelHref =
    props.onCancelHref ??
    (props.mode === "create"
      ? "/dashboard/insurance"
      : `/dashboard/insurance/${props.policyId}`);

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

        <div>
          <label htmlFor="policyType" className={labelClass}>
            Policy type <span className="text-red-600">*</span>
          </label>
          <select
            id="policyType"
            name="policyType"
            required
            defaultValue={d?.policyType ?? "pi"}
            className={inputClass}
          >
            {INSURANCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {insuranceTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="provider" className={labelClass}>
            Provider / club
          </label>
          <input
            id="provider"
            name="provider"
            defaultValue={d?.provider ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="policyNumber" className={labelClass}>
            Policy number
          </label>
          <Identifier mono>
            <input
              id="policyNumber"
              name="policyNumber"
              defaultValue={d?.policyNumber ?? ""}
              className={inputClass}
            />
          </Identifier>
        </div>

        <div>
          <label htmlFor="coverageAmount" className={labelClass}>
            Coverage amount
          </label>
          <input
            id="coverageAmount"
            name="coverageAmount"
            type="number"
            min={1}
            step={1}
            defaultValue={d?.coverageAmount ?? ""}
            className={inputClass}
          />
          {fieldErrors?.coverageAmount ? (
            <p className={errorText}>{fieldErrors.coverageAmount.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="currency" className={labelClass}>
            Currency
          </label>
          <input
            id="currency"
            name="currency"
            maxLength={3}
            placeholder="USD"
            defaultValue={d?.currency ?? ""}
            className={inputClass}
          />
          {fieldErrors?.currency ? (
            <p className={errorText}>{fieldErrors.currency.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="startDate" className={labelClass}>
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={d?.startDate ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="expiryDate" className={labelClass}>
            Expiry / renewal
          </label>
          <input
            id="expiryDate"
            name="expiryDate"
            type="date"
            defaultValue={d?.expiryDate ?? ""}
            className={inputClass}
          />
          {fieldErrors?.expiryDate ? (
            <p className={errorText}>{fieldErrors.expiryDate.join(" ")}</p>
          ) : null}
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
              ? "Add policy"
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
