"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState } from "react";
import {
  createAuditAction,
  updateAuditAction,
  type AuditActionState,
} from "@/modules/audits/actions";
import {
  AUDIT_TYPES,
  auditTypeLabel,
  type AuditListItem,
} from "@/modules/audits/audit.model";
import type { VesselRow } from "@/db/schema";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";
const errorText = "mt-1 text-sm text-[var(--error)]";

type AuditFormProps = {
  vessels: VesselRow[];
  onCancelHref?: string;
} & (
  | { mode: "create" }
  | {
      mode: "edit";
      auditId: string;
      defaultValues: AuditListItem;
    }
);

export function AuditForm(props: AuditFormProps) {
  const action =
    props.mode === "create"
      ? createAuditAction
      : updateAuditAction.bind(null, props.auditId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: AuditActionState | undefined,
      formData: FormData,
    ) => Promise<AuditActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const cancelHref =
    props.onCancelHref ??
    (props.mode === "create"
      ? "/dashboard/audits"
      : `/dashboard/audits/${props.auditId}`);

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
          <label htmlFor="auditType" className={labelClass}>
            Audit type <span className="text-[var(--error)]">*</span>
          </label>
          <select
            id="auditType"
            name="auditType"
            required
            defaultValue={d?.auditType ?? "ISSC"}
            className={inputClass}
          >
            {AUDIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {auditTypeLabel(t)}
              </option>
            ))}
          </select>
          {fieldErrors?.auditType ? (
            <p className={errorText}>{fieldErrors.auditType.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="auditDate" className={labelClass}>
            Audit date <span className="text-[var(--error)]">*</span>
          </label>
          <input
            id="auditDate"
            name="auditDate"
            type="date"
            required
            defaultValue={d?.auditDate ?? ""}
            className={inputClass}
          />
          {fieldErrors?.auditDate ? (
            <p className={errorText}>{fieldErrors.auditDate.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="auditor" className={labelClass}>
            Auditor
          </label>
          <input
            id="auditor"
            name="auditor"
            defaultValue={d?.auditor ?? ""}
            className={inputClass}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="findingsCount" className={labelClass}>
            Findings count
          </label>
          <input
            id="findingsCount"
            name="findingsCount"
            type="number"
            min={0}
            step={1}
            defaultValue={
              props.mode === "edit" ? (d?.findingsCount ?? "") : ""
            }
            className={inputClass}
          />
          {fieldErrors?.findingsCount ? (
            <p className={errorText}>{fieldErrors.findingsCount.join(" ")}</p>
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

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
        <Button variant="primary" type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : props.mode === "create"
              ? "Create audit"
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
