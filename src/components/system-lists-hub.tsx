/**
 * System Lists hub — cards + manage modal (left rail / right pane CRUD).
 * Spec: PROJECT_PLAN.md §7a System Lists.
 */
"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCertificateTypeAction,
  createIssuingAuthorityAction,
  deleteCertificateTypeFormAction,
  deleteIssuingAuthorityFormAction,
  updateCertificateTypeAction,
  updateIssuingAuthorityAction,
  type SystemListActionState,
} from "@/modules/certificates/actions";
import {
  createCrewCategoryAction,
  createEndorsementTypeAction,
  deleteCrewCategoryFormAction,
  deleteEndorsementTypeFormAction,
  updateCrewCategoryAction,
  updateEndorsementTypeAction,
} from "@/modules/crew/actions";
import {
  createDeficiencySeverityLevelAction,
  deleteDeficiencySeverityLevelFormAction,
  updateDeficiencySeverityLevelAction,
} from "@/modules/deficiencies/actions";
import {
  createDrawingCategoryAction,
  deleteDrawingCategoryFormAction,
  updateDrawingCategoryAction,
} from "@/modules/drawings/actions";
import {
  createIsmTemplateCategoryAction,
  deleteIsmTemplateCategoryFormAction,
  updateIsmTemplateCategoryAction,
} from "@/modules/ism-templates/actions";
import {
  CERTIFICATE_AUTHORITIES,
  REMINDER_RULE_KINDS,
} from "@/modules/certificates/certificate.model";

export type SystemListKey =
  | "certificate_types"
  | "issuing_authorities"
  | "ism_template_categories"
  | "drawing_categories"
  | "crew_categories"
  | "endorsement_types"
  | "deficiency_severity_levels";

export type SystemListRow = {
  id: string;
  name: string;
  isCustom?: boolean;
  authority?: string;
  ruleKind?: string;
  offsetDays?: number | null;
};

const LIST_META: { key: SystemListKey; label: string; description: string }[] =
  [
    {
      key: "certificate_types",
      label: "Certificate Types",
      description: "Validity variants and reminder rules",
    },
    {
      key: "issuing_authorities",
      label: "Issuing Authorities",
      description: "Organizations that issue certificates",
    },
    {
      key: "ism_template_categories",
      label: "ISM Template Categories",
      description: "Form categories for ISM templates",
    },
    {
      key: "drawing_categories",
      label: "Drawing Categories",
      description: "Technical drawing categories",
    },
    {
      key: "crew_categories",
      label: "Crew Categories",
      description: "Ranks / categories for crew members",
    },
    {
      key: "endorsement_types",
      label: "Endorsement Types",
      description: "STCW and similar endorsement kinds",
    },
    {
      key: "deficiency_severity_levels",
      label: "Deficiency Severity Levels",
      description: "User-defined severity labels (form wiring later)",
    },
  ];

type ActionFn = (
  prev: SystemListActionState | undefined,
  formData: FormData,
) => Promise<SystemListActionState>;

const CREATE: Record<SystemListKey, ActionFn> = {
  certificate_types: createCertificateTypeAction,
  issuing_authorities: createIssuingAuthorityAction,
  ism_template_categories: createIsmTemplateCategoryAction,
  drawing_categories: createDrawingCategoryAction,
  crew_categories: createCrewCategoryAction,
  endorsement_types: createEndorsementTypeAction,
  deficiency_severity_levels: createDeficiencySeverityLevelAction,
};

const UPDATE: Record<SystemListKey, ActionFn> = {
  certificate_types: updateCertificateTypeAction,
  issuing_authorities: updateIssuingAuthorityAction,
  ism_template_categories: updateIsmTemplateCategoryAction,
  drawing_categories: updateDrawingCategoryAction,
  crew_categories: updateCrewCategoryAction,
  endorsement_types: updateEndorsementTypeAction,
  deficiency_severity_levels: updateDeficiencySeverityLevelAction,
};

const DELETE: Record<
  SystemListKey,
  (formData: FormData) => Promise<SystemListActionState>
> = {
  certificate_types: deleteCertificateTypeFormAction,
  issuing_authorities: deleteIssuingAuthorityFormAction,
  ism_template_categories: deleteIsmTemplateCategoryFormAction,
  drawing_categories: deleteDrawingCategoryFormAction,
  crew_categories: deleteCrewCategoryFormAction,
  endorsement_types: deleteEndorsementTypeFormAction,
  deficiency_severity_levels: deleteDeficiencySeverityLevelFormAction,
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

export function SystemListsHub({
  lists,
}: {
  lists: Record<SystemListKey, SystemListRow[]>;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<SystemListKey>("certificate_types");

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LIST_META.map((meta) => (
          <button
            key={meta.key}
            type="button"
            onClick={() => {
              setActive(meta.key);
              setOpen(true);
            }}
            className="rounded-lg border border-zinc-200 bg-white p-4 text-start transition-colors hover:border-[#378ADD] dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {meta.label}
              </span>
              <span className="text-sm tabular-nums text-zinc-500">
                {lists[meta.key].length}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {meta.description}
            </p>
          </button>
        ))}
      </div>

      {open ? (
        <SystemListsModal
          lists={lists}
          active={active}
          onActiveChange={setActive}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function SystemListsModal({
  lists,
  active,
  onActiveChange,
  onClose,
}: {
  lists: Record<SystemListKey, SystemListRow[]>;
  active: SystemListKey;
  onActiveChange: (key: SystemListKey) => void;
  onClose: () => void;
}) {
  const meta = LIST_META.find((m) => m.key === active)!;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage System Lists"
        className="relative flex h-[min(90vh,720px)] w-full max-w-4xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        <aside className="hidden w-56 shrink-0 flex-col border-e border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 sm:flex">
          <div className="border-b border-zinc-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
            Lists
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            {LIST_META.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onActiveChange(item.key)}
                className={`mb-0.5 w-full rounded-md px-2 py-2 text-start text-sm ${
                  active === item.key
                    ? "bg-[#0D2B45] text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label}
                <span className="ms-1 opacity-70">
                  ({lists[item.key].length})
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {meta.label}
              </h2>
              <p className="text-sm text-zinc-500">{meta.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          </div>

          <div className="border-b border-zinc-200 px-4 py-2 sm:hidden dark:border-zinc-800">
            <select
              className={inputClass}
              value={active}
              onChange={(e) => onActiveChange(e.target.value as SystemListKey)}
              aria-label="List"
            >
              {LIST_META.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Remount on list change so action state / edit form reset without effects. */}
          <SystemListPane key={active} listKey={active} rows={lists[active]} />
        </div>
      </div>
    </div>
  );
}

function SystemListPane({
  listKey,
  rows,
}: {
  listKey: SystemListKey;
  rows: SystemListRow[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteFlash, setDeleteFlash] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [pendingDelete, startDelete] = useTransition();

  const [createState, createAction, createPending] = useActionState(
    CREATE[listKey],
    undefined,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    UPDATE[listKey],
    undefined,
  );

  // Close the edit form when a new successful update result arrives.
  // Track previous action state in React state (not a ref) so we can adjust
  // during render — the recommended alternative to setState-in-effect.
  const [prevUpdateState, setPrevUpdateState] = useState(updateState);
  if (updateState !== prevUpdateState) {
    setPrevUpdateState(updateState);
    if (updateState?.ok && editingId !== null) {
      setEditingId(null);
    }
  }

  useEffect(() => {
    if (createState?.ok || updateState?.ok) {
      router.refresh();
    }
  }, [createState, updateState, router]);

  // Derive create/update banners from action state; deleteFlash is only for
  // the startTransition delete path (setState there is fine — not an effect).
  const banner = (() => {
    if (createState?.ok) {
      return { ok: true as const, message: createState.message ?? "Added." };
    }
    if (createState && !createState.ok) {
      return { ok: false as const, message: createState.message };
    }
    if (updateState?.ok) {
      return { ok: true as const, message: updateState.message ?? "Saved." };
    }
    if (updateState && !updateState.ok) {
      return { ok: false as const, message: updateState.message };
    }
    if (deleteFlash) {
      return {
        ok: deleteFlash.ok,
        message: deleteFlash.message,
      };
    }
    return null;
  })();

  function onDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startDelete(async () => {
      const result = await DELETE[listKey](fd);
      if (result.ok) {
        setDeleteFlash({
          ok: true,
          message: result.message ?? "Deleted.",
        });
        router.refresh();
      } else {
        setDeleteFlash({ ok: false, message: result.message });
      }
    });
  }

  return (
    <>
      {banner ? (
        <div
          className={`mx-4 mt-3 rounded-md px-3 py-2 text-sm ${
            banner.ok
              ? "border border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200"
              : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          }`}
          role={banner.ok ? "status" : "alert"}
        >
          {banner.message}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.length === 0 ? (
            <li className="py-8 text-center text-sm text-zinc-500">
              No items yet.
            </li>
          ) : (
            rows.map((row) => (
              <li key={row.id} className="py-3">
                {editingId === row.id ? (
                  <EditRowForm
                    listKey={listKey}
                    row={row}
                    action={updateAction}
                    pending={updatePending}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {row.name}
                      </p>
                      {row.authority ? (
                        <p className="text-xs text-zinc-500">
                          {row.authority}
                          {row.ruleKind ? ` · ${row.ruleKind}` : ""}
                          {row.offsetDays != null
                            ? ` · ${row.offsetDays}d`
                            : ""}
                        </p>
                      ) : null}
                      {row.isCustom === false ? (
                        <span className="text-[11px] text-zinc-400">
                          Seeded
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-[#378ADD] hover:underline"
                        onClick={() => setEditingId(row.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pendingDelete}
                        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                        onClick={() => onDelete(row.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <AddRowForm
          listKey={listKey}
          action={createAction}
          pending={createPending}
        />
      </div>
    </>
  );
}

function AddRowForm({
  listKey,
  action,
  pending,
}: {
  listKey: SystemListKey;
  action: (payload: FormData) => void;
  pending: boolean;
}) {
  if (listKey === "certificate_types") {
    return (
      <form action={action} className="grid gap-2 sm:grid-cols-4">
        <select
          name="authority"
          required
          defaultValue="flag"
          className={inputClass}
          aria-label="Authority"
        >
          {CERTIFICATE_AUTHORITIES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          name="name"
          required
          placeholder="New type name"
          className={`${inputClass} sm:col-span-2`}
        />
        <input type="hidden" name="ruleKind" value="expiry_offset" />
        <input type="hidden" name="offsetDays" value="30" />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="flex gap-2">
      <input
        name="name"
        required
        placeholder="Add new item"
        className={inputClass}
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}

function EditRowForm({
  listKey,
  row,
  action,
  pending,
  onCancel,
}: {
  listKey: SystemListKey;
  row: SystemListRow;
  action: (payload: FormData) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  if (listKey === "certificate_types") {
    return (
      <form action={action} className="grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="id" value={row.id} />
        <select
          name="authority"
          defaultValue={row.authority ?? "flag"}
          className={inputClass}
        >
          {CERTIFICATE_AUTHORITIES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          name="name"
          required
          defaultValue={row.name}
          className={inputClass}
        />
        <select
          name="ruleKind"
          defaultValue={row.ruleKind ?? "expiry_offset"}
          className={inputClass}
        >
          {REMINDER_RULE_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          name="offsetDays"
          type="number"
          min={1}
          defaultValue={row.offsetDays ?? ""}
          placeholder="Offset days"
          className={inputClass}
        />
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[#378ADD] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={row.id} />
      <input
        name="name"
        required
        defaultValue={row.name}
        className={`${inputClass} min-w-[12rem] flex-1`}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#378ADD] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
      >
        Cancel
      </button>
    </form>
  );
}
