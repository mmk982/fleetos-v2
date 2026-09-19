"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import {
  createMonthlyFormRequirementAction,
  updateMonthlyFormRequirementAction,
  type MonthlyFormActionState,
} from "@/modules/monthly-forms/actions";
import {
  MONTHLY_FORM_FREQUENCIES,
  monthlyFormFrequencyLabel,
} from "@/modules/monthly-forms/monthlyForm.model";
import type { IsmTemplateListItem } from "@/modules/ism-templates/ismTemplate.model";
import type { VesselRow } from "@/db/schema";

const labelClass =
  "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type Props = {
  vessels: VesselRow[];
  templates: IsmTemplateListItem[];
  onCancel?: () => void;
} & (
  | { mode: "create" }
  | {
      mode: "edit";
      requirementId: string;
      defaultValues: {
        vesselId: string;
        ismTemplateId: string;
        frequency: string;
        activeStatus: boolean;
      };
    }
);

export function MonthlyFormRequirementForm(props: Props) {
  const action =
    props.mode === "create"
      ? createMonthlyFormRequirementAction
      : updateMonthlyFormRequirementAction.bind(null, props.requirementId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: MonthlyFormActionState | undefined,
      formData: FormData,
    ) => Promise<MonthlyFormActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;

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

      <div>
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
        <label htmlFor="ismTemplateId" className={labelClass}>
          ISM template <span className="text-red-600">*</span>
        </label>
        <select
          id="ismTemplateId"
          name="ismTemplateId"
          required
          defaultValue={d?.ismTemplateId ?? ""}
          className={inputClass}
        >
          <option value="" disabled>
            Select template
          </option>
          {props.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.formCode} — {t.formName}
            </option>
          ))}
        </select>
        {fieldErrors?.ismTemplateId ? (
          <p className={errorText}>{fieldErrors.ismTemplateId.join(" ")}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="frequency" className={labelClass}>
          Frequency
        </label>
        <select
          id="frequency"
          name="frequency"
          defaultValue={d?.frequency ?? "monthly"}
          className={inputClass}
        >
          {MONTHLY_FORM_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {monthlyFormFrequencyLabel(f)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="activeStatus" className={labelClass}>
          Active
        </label>
        <select
          id="activeStatus"
          name="activeStatus"
          defaultValue={d?.activeStatus === false ? "false" : "true"}
          className={inputClass}
        >
          <option value="true">Active (include in checklist)</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" type="submit"
          disabled={pending}>
          {pending
            ? "Saving…"
            : props.mode === "create"
              ? "Add requirement"
              : "Save"}
        </Button>
        {props.onCancel ? (
          <Button variant="secondary" type="button"
            onClick={props.onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
