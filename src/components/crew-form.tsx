"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState } from "react";
import {
  createCrewMemberAction,
  updateCrewMemberAction,
  type CrewActionState,
} from "@/modules/crew/actions";
import { CREW_STATUSES, crewMemberStatusLabel } from "@/modules/crew/crew.model";
import type {
  CrewCategoryRow,
  CrewMemberRow,
  VesselRow,
} from "@/db/schema";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-none border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type CrewFormProps = {
  vessels: VesselRow[];
  categories: CrewCategoryRow[];
  onCancelHref?: string;
} & (
  | { mode: "create" }
  | { mode: "edit"; crewMemberId: string; defaultValues: CrewMemberRow }
);

export function CrewForm(props: CrewFormProps) {
  const action =
    props.mode === "create"
      ? createCrewMemberAction
      : updateCrewMemberAction.bind(null, props.crewMemberId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: CrewActionState | undefined,
      formData: FormData,
    ) => Promise<CrewActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const cancelHref =
    props.onCancelHref ??
    (props.mode === "create"
      ? "/dashboard/crew"
      : `/dashboard/crew/${props.crewMemberId}`);

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
        <div>
          <label htmlFor="firstName" className={labelClass}>
            First name <span className="text-red-600">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            maxLength={100}
            defaultValue={d?.firstName ?? ""}
            className={inputClass}
          />
          {fieldErrors?.firstName ? (
            <p className={errorText}>{fieldErrors.firstName.join(" ")}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="lastName" className={labelClass}>
            Last name <span className="text-red-600">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            required
            maxLength={100}
            defaultValue={d?.lastName ?? ""}
            className={inputClass}
          />
          {fieldErrors?.lastName ? (
            <p className={errorText}>{fieldErrors.lastName.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="categoryId" className={labelClass}>
            Category / rank
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={d?.categoryId ?? ""}
            className={inputClass}
          >
            <option value="">—</option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
            {CREW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {crewMemberStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="vesselId" className={labelClass}>
            Assigned vessel
          </label>
          <select
            id="vesselId"
            name="vesselId"
            defaultValue={d?.vesselId ?? ""}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {props.vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="nationality" className={labelClass}>
            Nationality
          </label>
          <input
            id="nationality"
            name="nationality"
            defaultValue={d?.nationality ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="dateOfBirth" className={labelClass}>
            Date of birth
          </label>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={d?.dateOfBirth ?? ""}
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
              ? "Add crew member"
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
