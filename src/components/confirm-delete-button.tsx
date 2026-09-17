/**
 * Delete confirmation using the shared {@link Modal} primitive.
 * Invokes an existing form-style Server Action with a constructed FormData.
 */
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
      <Button variant="destructive" size="md" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} ariaLabel={title}>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {description}
        </p>
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
                const fd = new FormData();
                fd.set(idFieldName, id);
                await action(fd);
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
