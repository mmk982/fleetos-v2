"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Identifier } from "@/components/ui/identifier";
import {
  createDeficiencyAction,
  updateDeficiencyAction,
  type DeficiencyActionState,
} from "@/modules/deficiencies/actions";
import {
  DEFICIENCY_STATUSES,
  deficiencySourceLabel,
  deficiencyStatusLabel,
} from "@/modules/deficiencies/deficiency.model";
import type {
  DeficiencyRow,
  DeficiencySourceRow,
  VesselRow,
} from "@/db/schema";
import type { PscInspectionListItem } from "@/modules/psc/psc.model";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";
const errorText = "mt-1 text-sm text-[var(--error)]";

type DeficiencyFormProps = {
  vessels: VesselRow[];
  sources: DeficiencySourceRow[];
  pscInspections: PscInspectionListItem[];
  onCancelHref?: string;
} & (
  | { mode: "create" }
  | { mode: "edit"; deficiencyId: string; defaultValues: DeficiencyRow }
);

export function DeficiencyForm(props: DeficiencyFormProps) {
  const action =
    props.mode === "create"
      ? createDeficiencyAction
      : updateDeficiencyAction.bind(null, props.deficiencyId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: DeficiencyActionState | undefined,
      formData: FormData,
    ) => Promise<DeficiencyActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const cancelHref =
    props.onCancelHref ??
    (props.mode === "create"
      ? "/dashboard/deficiencies"
      : `/dashboard/deficiencies/${props.deficiencyId}`);

  const defaultSourceId =
    d?.sourceId ??
    props.sources.find((s) => s.name === "internal")?.id ??
    props.sources[0]?.id ??
    "";

  const [vesselId, setVesselId] = useState(d?.vesselId ?? "");
  const [sourceId, setSourceId] = useState(defaultSourceId);

  const selectedSource = props.sources.find((s) => s.id === sourceId);
  const showPscLink = selectedSource?.name === "psc";

  const vesselPscInspections = useMemo(
    () =>
      props.pscInspections.filter(
        (i) => !vesselId || i.vesselId === vesselId,
      ),
    [props.pscInspections, vesselId],
  );

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
            value={vesselId}
            onChange={(e) => setVesselId(e.target.value)}
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
          <label htmlFor="title" className={labelClass}>
            Title <span className="text-[var(--error)]">*</span>
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={d?.title ?? ""}
            className={inputClass}
            autoComplete="off"
          />
          {fieldErrors?.title ? (
            <p className={errorText}>{fieldErrors.title.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="deficiencyNumber" className={labelClass}>
            Deficiency number
          </label>
          <Identifier>
            <input
              id="deficiencyNumber"
              name="deficiencyNumber"
              defaultValue={d?.deficiencyNumber ?? ""}
              className={`${inputClass} font-mono`}
              autoComplete="off"
            />
          </Identifier>
        </div>

        <div>
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <input
            id="category"
            name="category"
            defaultValue={d?.category ?? ""}
            className={inputClass}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="sourceId" className={labelClass}>
            Source <span className="text-[var(--error)]">*</span>
          </label>
          <select
            id="sourceId"
            name="sourceId"
            required
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className={inputClass}
          >
            {props.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {deficiencySourceLabel(s.name)}
              </option>
            ))}
          </select>
          {fieldErrors?.sourceId ? (
            <p className={errorText}>{fieldErrors.sourceId.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={d?.status ?? "open"}
            className={inputClass}
          >
            {DEFICIENCY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {deficiencyStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        {showPscLink ? (
          <div className="sm:col-span-2">
            <label htmlFor="pscInspectionId" className={labelClass}>
              Link to PSC Inspection
            </label>
            <select
              id="pscInspectionId"
              name="pscInspectionId"
              defaultValue={d?.pscInspectionId ?? ""}
              className={inputClass}
              disabled={!vesselId}
            >
              <option value="">None</option>
              {vesselPscInspections.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.port} · {i.inspectionDate} · {i.authority}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Optional — only inspections for the selected vessel.
            </p>
          </div>
        ) : (
          <input type="hidden" name="pscInspectionId" value="" />
        )}

        <div>
          <label htmlFor="identifiedDate" className={labelClass}>
            Identified date
          </label>
          <input
            id="identifiedDate"
            name="identifiedDate"
            type="date"
            defaultValue={d?.identifiedDate ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="dueDate" className={labelClass}>
            Due date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={d?.dueDate ?? ""}
            className={inputClass}
          />
          {fieldErrors?.dueDate ? (
            <p className={errorText}>{fieldErrors.dueDate.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="closedDate" className={labelClass}>
            Closed date
          </label>
          <input
            id="closedDate"
            name="closedDate"
            type="date"
            defaultValue={d?.closedDate ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="responsiblePerson" className={labelClass}>
            Responsible person
          </label>
          <input
            id="responsiblePerson"
            name="responsiblePerson"
            defaultValue={d?.responsiblePerson ?? ""}
            className={inputClass}
            autoComplete="off"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="reference" className={labelClass}>
            Reference
          </label>
          <input
            id="reference"
            name="reference"
            defaultValue={d?.reference ?? ""}
            className={inputClass}
            autoComplete="off"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className={labelClass}>
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={d?.description ?? ""}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="correctiveAction" className={labelClass}>
            Corrective action
          </label>
          <textarea
            id="correctiveAction"
            name="correctiveAction"
            rows={3}
            defaultValue={d?.correctiveAction ?? ""}
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
            rows={2}
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
              ? "Create deficiency"
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
