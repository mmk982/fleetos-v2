"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import {
  createCrewCertificateAction,
  updateCrewCertificateAction,
  type CrewActionState,
} from "@/modules/crew/actions";
import type {
  CrewCertificateRow,
  EndorsementTypeRow,
} from "@/db/schema";
import { Identifier } from "@/components/ui/identifier";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type Props = {
  crewMemberId: string;
  endorsementTypes: EndorsementTypeRow[];
  onCancel: () => void;
  onSuccess?: () => void;
} & (
  | { mode: "create" }
  | { mode: "edit"; certificate: CrewCertificateRow }
);

export function CrewCertificateForm(props: Props) {
  const action =
    props.mode === "create"
      ? createCrewCertificateAction
      : updateCrewCertificateAction.bind(
          null,
          props.certificate.id,
          props.crewMemberId,
        );

  const [state, formAction, pending] = useActionState(
    async (prev: CrewActionState | undefined, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.ok) props.onSuccess?.();
      return result;
    },
    undefined as CrewActionState | undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.certificate : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="crewMemberId" value={props.crewMemberId} />
      {state && !state.ok ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <label htmlFor="cert-name" className={labelClass}>
          Document name <span className="text-red-600">*</span>
        </label>
        <input
          id="cert-name"
          name="name"
          required
          maxLength={200}
          defaultValue={d?.name ?? ""}
          placeholder="e.g. Passport, STCW II/2, ENG1"
          className={inputClass}
        />
        {fieldErrors?.name ? (
          <p className={errorText}>{fieldErrors.name.join(" ")}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="documentNumber" className={labelClass}>
            Document number
          </label>
          <Identifier mono>
            <input
              id="documentNumber"
              name="documentNumber"
              defaultValue={d?.documentNumber ?? ""}
              className={inputClass}
            />
          </Identifier>
        </div>
        <div>
          <label htmlFor="issuingAuthority" className={labelClass}>
            Issuing authority
          </label>
          <input
            id="issuingAuthority"
            name="issuingAuthority"
            defaultValue={d?.issuingAuthority ?? ""}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="endorsementTypeId" className={labelClass}>
            Endorsement type
          </label>
          <select
            id="endorsementTypeId"
            name="endorsementTypeId"
            defaultValue={d?.endorsementTypeId ?? ""}
            className={inputClass}
          >
            <option value="">None</option>
            {props.endorsementTypes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
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
        <div className="sm:col-span-2">
          <label htmlFor="cert-notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="cert-notes"
            name="notes"
            rows={2}
            defaultValue={d?.notes ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" type="button"
          onClick={props.onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit"
          disabled={pending}>
          {pending ? "Saving…" : props.mode === "create" ? "Add document" : "Save"}
        </Button>
      </div>
    </form>
  );
}
