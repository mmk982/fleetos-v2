"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  createCertificateAction,
  updateCertificateAction,
  type CertificateActionState,
} from "@/modules/certificates/actions";
import {
  CERTIFICATE_LIFECYCLES,
  formatAuthority,
} from "@/modules/certificates/certificate.model";
import type {
  CertificateRow,
  CertificateTypeRow,
  IssuingAuthorityRow,
} from "@/db/schema";
import type { VesselRow } from "@/db/schema";
import { Identifier } from "@/components/ui/identifier";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

/** Top-level certificates that can be selected as a parent (one-level rule). */
export type ParentCertificateOption = {
  id: string;
  vesselId: string;
  typeName: string;
  certificateNumber: string | null;
};

type CertificateFormProps = {
  vessels: VesselRow[];
  types: CertificateTypeRow[];
  authorities: IssuingAuthorityRow[];
  parentCandidates: ParentCertificateOption[];
  /** When true, this row already has sub-items and cannot itself be nested. */
  hasSubItems?: boolean;
} & (
  | { mode: "create" }
  | { mode: "edit"; certificateId: string; defaultValues: CertificateRow }
);

export function CertificateForm(props: CertificateFormProps) {
  const action =
    props.mode === "create"
      ? createCertificateAction
      : updateCertificateAction.bind(null, props.certificateId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: CertificateActionState | undefined,
      formData: FormData,
    ) => Promise<CertificateActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const selfId = props.mode === "edit" ? props.certificateId : null;
  const [vesselId, setVesselId] = useState(d?.vesselId ?? "");
  const [parentCertificateId, setParentCertificateId] = useState(
    d?.parentCertificateId ?? "",
  );

  const parentOptions = useMemo(
    () =>
      props.parentCandidates.filter(
        (row) => row.vesselId === vesselId && row.id !== selfId,
      ),
    [props.parentCandidates, vesselId, selfId],
  );

  const typesByAuthority = new Map<string, CertificateTypeRow[]>();
  for (const t of props.types) {
    const list = typesByAuthority.get(t.authority) ?? [];
    list.push(t);
    typesByAuthority.set(t.authority, list);
  }

  return (
    <form action={formAction} className="mx-auto max-w-3xl space-y-6">
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
          <label htmlFor="vesselId" className={labelClass}>
            Vessel <span className="text-red-600">*</span>
          </label>
          <select
            id="vesselId"
            name="vesselId"
            required
            value={vesselId}
            onChange={(e) => {
              const nextVesselId = e.target.value;
              setVesselId(nextVesselId);
              const parentStillValid = props.parentCandidates.some(
                (row) =>
                  row.id === parentCertificateId &&
                  row.vesselId === nextVesselId &&
                  row.id !== selfId,
              );
              if (!parentStillValid) {
                setParentCertificateId("");
              }
            }}
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
          <label htmlFor="certificateTypeId" className={labelClass}>
            Certificate type <span className="text-red-600">*</span>
          </label>
          <select
            id="certificateTypeId"
            name="certificateTypeId"
            required
            defaultValue={d?.certificateTypeId ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Select type
            </option>
            {[...typesByAuthority.entries()].map(([authority, rows]) => (
              <optgroup key={authority} label={formatAuthority(authority)}>
                {rows.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Need a new type? Add it under{" "}
            <Link href="/dashboard/settings" className="underline underline-offset-2">
              Settings
            </Link>
            .
          </p>
          {fieldErrors?.certificateTypeId ? (
            <p className={errorText}>{fieldErrors.certificateTypeId.join(" ")}</p>
          ) : null}
        </div>

        {props.hasSubItems ? (
          <div className="sm:col-span-2">
            <p className="text-sm text-[var(--text-secondary)]">
              This certificate already has sub-items, so it cannot be linked under
              another parent.
            </p>
          </div>
        ) : (
        <div className="sm:col-span-2">
          <label htmlFor="parentCertificateId" className={labelClass}>
            Parent certificate
          </label>
          <select
            id="parentCertificateId"
            name="parentCertificateId"
            disabled={!vesselId}
            value={parentCertificateId}
            onChange={(e) => setParentCertificateId(e.target.value)}
            className={inputClass}
          >
            <option value="">
              {vesselId ? "None — top-level certificate" : "Select a vessel first"}
            </option>
            {parentOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.typeName}
                {row.certificateNumber ? ` · ${row.certificateNumber}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Optional. Link a sub-item (EPIRB Battery, Lifeboat Load Test, VDR APT, …)
            to its equipment certificate on the same vessel.
          </p>
          {fieldErrors?.parentCertificateId ? (
            <p className={errorText}>{fieldErrors.parentCertificateId.join(" ")}</p>
          ) : null}
        </div>
        )}

        <div>
          <label htmlFor="certificateNumber" className={labelClass}>
            Certificate number
          </label>
          <Identifier mono>
            <input
              id="certificateNumber"
              name="certificateNumber"
              defaultValue={d?.certificateNumber ?? ""}
              className={inputClass}
              autoComplete="off"
            />
          </Identifier>
        </div>

        <div>
          <label htmlFor="issuingAuthorityId" className={labelClass}>
            Issuing authority
          </label>
          <select
            id="issuingAuthorityId"
            name="issuingAuthorityId"
            defaultValue={d?.issuingAuthorityId ?? ""}
            className={inputClass}
          >
            <option value="">—</option>
            {props.authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Missing an issuer? Add it under{" "}
            <Link href="/dashboard/settings" className="underline underline-offset-2">
              Settings
            </Link>
            .
          </p>
        </div>

        <div>
          <label htmlFor="issueDate" className={labelClass}>
            Issue date
          </label>
          <input
            id="issueDate"
            name="issueDate"
            type="date"
            defaultValue={d?.issueDate ?? ""}
            className={inputClass}
          />
          {fieldErrors?.issueDate ? (
            <p className={errorText}>{fieldErrors.issueDate.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="expiryDate" className={labelClass}>
            Expiry date
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

        <div>
          <label htmlFor="windowOpenDate" className={labelClass}>
            Window open
          </label>
          <input
            id="windowOpenDate"
            name="windowOpenDate"
            type="date"
            defaultValue={d?.windowOpenDate ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="windowCloseDate" className={labelClass}>
            Window close
          </label>
          <input
            id="windowCloseDate"
            name="windowCloseDate"
            type="date"
            defaultValue={d?.windowCloseDate ?? ""}
            className={inputClass}
          />
          {fieldErrors?.windowCloseDate ? (
            <p className={errorText}>{fieldErrors.windowCloseDate.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="customOffsetDays" className={labelClass}>
            Reminder days (override)
          </label>
          <input
            id="customOffsetDays"
            name="customOffsetDays"
            inputMode="numeric"
            placeholder="Inherit from type"
            defaultValue={d?.customOffsetDays ?? ""}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Leave blank to inherit the type default (or 180 if linked to dry dock).
          </p>
        </div>

        <div>
          <label htmlFor="lifecycleStatus" className={labelClass}>
            Lifecycle
          </label>
          <select
            id="lifecycleStatus"
            name="lifecycleStatus"
            defaultValue={d?.lifecycleStatus ?? "active"}
            className={inputClass}
          >
            {CERTIFICATE_LIFECYCLES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="linkedToDryDock"
            name="linkedToDryDock"
            type="checkbox"
            value="true"
            defaultChecked={d?.linkedToDryDock ?? false}
            className="h-4 w-4 rounded border-[var(--border)]"
          />
          <label htmlFor="linkedToDryDock" className="text-sm text-[var(--text-secondary)]">
            Linked to dry dock / renewal (forces 180-day reminder unless custom days set)
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="remarks" className={labelClass}>
          Remarks
        </label>
        <textarea
          id="remarks"
          name="remarks"
          rows={3}
          defaultValue={d?.remarks ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-6">
        <Button variant="primary" type="submit"
          disabled={pending}>
          {pending
            ? "Saving…"
            : props.mode === "create"
              ? "Create certificate"
              : "Save changes"}
        </Button>
        <Link
          href={
            props.mode === "create"
              ? "/dashboard/certificates"
              : `/dashboard/certificates/${props.certificateId}`
          }
          className="text-sm font-medium text-[var(--text-secondary)] underline-offset-4 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
