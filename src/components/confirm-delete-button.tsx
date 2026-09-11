/**
 * Delete confirmation using the shared {@link Modal} primitive.
 * Invokes an existing form-style Server Action with a constructed FormData.
 */
"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";

export function ConfirmDeleteButton({
  label = "Delete",
  title,
  description,
  id,
  idFieldName = "id",
  action,
}: {
  label?: string;
  title: string;
  description: string;
  /** Primary key passed to the Server Action as FormData. */
  id: string;
  idFieldName?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/30"
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} ariaLabel={title}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-10 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set(idFieldName, id);
                await action(fd);
              });
            }}
            className="h-10 rounded-md bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Deleting…" : label}
          </button>
        </div>
      </Modal>
    </>
  );
}
