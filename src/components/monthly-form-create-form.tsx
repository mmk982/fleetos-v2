"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createMonthlyFormAction, type MonthlyFormActionState } from "@/modules/monthly-forms/actions";
import type { IsmTemplateListItem } from "@/modules/ism-templates/ismTemplate.model";
import type { VesselRow } from "@/db/schema";

const labelClass =
  "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

export function MonthlyFormCreateForm({
  vessels,
  templates,
}: {
  vessels: VesselRow[];
  templates: IsmTemplateListItem[];
}) {
  const now = new Date();
  const [state, formAction, pending] = useActionState(
    createMonthlyFormAction,
    undefined as MonthlyFormActionState | undefined,
  );
  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="vesselId" className={labelClass}>
            Vessel <span className="text-red-600">*</span>
          </label>
          <select
            id="vesselId"
            name="vesselId"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              Select vessel
            </option>
            {vessels.map((v) => (
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
          <label htmlFor="ismTemplateId" className={labelClass}>
            ISM template (optional)
          </label>
          <select
            id="ismTemplateId"
            name="ismTemplateId"
            defaultValue=""
            className={inputClass}
          >
            <option value="">None — ad-hoc form</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.formCode} — {t.formName}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="formName" className={labelClass}>
            Form name
          </label>
          <input
            id="formName"
            name="formName"
            className={inputClass}
            placeholder="Required if no template selected"
          />
          {fieldErrors?.formName ? (
            <p className={errorText}>{fieldErrors.formName.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="month" className={labelClass}>
            Month <span className="text-red-600">*</span>
          </label>
          <input
            id="month"
            name="month"
            type="number"
            min={1}
            max={12}
            required
            defaultValue={now.getMonth() + 1}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="year" className={labelClass}>
            Year <span className="text-red-600">*</span>
          </label>
          <input
            id="year"
            name="year"
            type="number"
            min={2000}
            max={2100}
            required
            defaultValue={now.getFullYear()}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="remarks" className={labelClass}>
            Remarks
          </label>
          <textarea id="remarks" name="remarks" rows={3} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create form"}
        </button>
        <Link
          href="/dashboard/monthly-forms"
          className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-secondary)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
