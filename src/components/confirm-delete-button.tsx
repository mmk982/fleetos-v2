/**
 * Delete confirmation using the shared {@link Modal} primitive.
 * Invokes an existing form-style Server Action with a constructed FormData.
 */
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type DeleteActionResult = void | { ok: true } | { ok: false; message: string };

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
  action: (formData: FormData) => Promise<DeleteActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="destructive"
        size="md"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} ariaLabel={title}>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {description}
        </p>
        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                setError(null);
                const fd = new FormData();
                fd.set(idFieldName, id);
                const result = await action(fd);
                if (result && result.ok === false) {
                  setError(result.message);
                }
              });
            }}
          >
            {pending ? "Deleting…" : label}
          </Button>
        </div>
      </Modal>
    </>
  );
}
