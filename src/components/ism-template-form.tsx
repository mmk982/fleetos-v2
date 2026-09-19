"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useActionState } from "react";
import {
  createIsmTemplateAction,
  updateIsmTemplateAction,
  type IsmTemplateActionState,
} from "@/modules/ism-templates/actions";
import {
  ISM_TEMPLATE_STATUSES,
  ismTemplateStatusLabel,
} from "@/modules/ism-templates/ismTemplate.model";
import type {
  IsmTemplateCategoryRow,
  IsmTemplateRow,
} from "@/db/schema";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

type Props = {
  categories: IsmTemplateCategoryRow[];
  onCancelHref?: string;
} & (
  | { mode: "create" }
  | { mode: "edit"; templateId: string; defaultValues: IsmTemplateRow }
);

export function IsmTemplateForm(props: Props) {
  const action =
    props.mode === "create"
      ? createIsmTemplateAction
      : updateIsmTemplateAction.bind(null, props.templateId);

  const [state, formAction, pending] = useActionState(
    action as (
      prev: IsmTemplateActionState | undefined,
      formData: FormData,
    ) => Promise<IsmTemplateActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;
  const d = props.mode === "edit" ? props.defaultValues : null;
  const cancelHref =
    props.onCancelHref ??
    (props.mode === "create"
      ? "/dashboard/ism-templates"
      : `/dashboard/ism-templates/${props.templateId}`);

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
        <div>
          <label htmlFor="formCode" className={labelClass}>
            Form code <span className="text-red-600">*</span>
          </label>
          <input
            id="formCode"
            name="formCode"
            required
            maxLength={100}
            defaultValue={d?.formCode ?? ""}
            className={inputClass}
          />
          {fieldErrors?.formCode ? (
            <p className={errorText}>{fieldErrors.formCode.join(" ")}</p>
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
            {ISM_TEMPLATE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ismTemplateStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="formName" className={labelClass}>
            Form name <span className="text-red-600">*</span>
          </label>
          <input
            id="formName"
            name="formName"
            required
            maxLength={200}
            defaultValue={d?.formName ?? ""}
            className={inputClass}
          />
          {fieldErrors?.formName ? (
            <p className={errorText}>{fieldErrors.formName.join(" ")}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="categoryId" className={labelClass}>
            Category <span className="text-red-600">*</span>
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={d?.categoryId ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Select category
            </option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldErrors?.categoryId ? (
            <p className={errorText}>{fieldErrors.categoryId.join(" ")}</p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Category management moves to Settings later.
          </p>
        </div>

        <div>
          <label htmlFor="revision" className={labelClass}>
            Revision
          </label>
          <input
            id="revision"
            name="revision"
            defaultValue={d?.revision ?? ""}
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
              ? "Add template"
              : "Save changes"}
        </Button>
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-secondary)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
