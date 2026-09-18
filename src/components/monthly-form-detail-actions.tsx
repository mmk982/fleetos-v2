"use client";

import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { MonthlyFormSubmit } from "@/components/monthly-form-submit";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { deleteMonthlyFormAttachmentAction } from "@/modules/monthly-forms/actions";
import type { MonthlyExecutedFormAttachmentRow } from "@/db/schema";

export function MonthlyFormDetailActions({
  executedFormId,
  attachments,
}: {
  executedFormId: string;
  attachments: MonthlyExecutedFormAttachmentRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const onSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Attachments
        </h2>
        <Button variant="primary" type="button"
          onClick={() => setOpen(true)}>
          Submit / upload
        </Button>
      </div>

      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
        {attachments.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
            No files yet.
          </li>
        ) : (
          attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <a
                href={`/api/attachments/${a.id}`}
                className="font-medium text-[#378ADD] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                <Identifier>{a.fileName}</Identifier>
              </a>
              <form action={deleteMonthlyFormAttachmentAction}>
                <input type="hidden" name="id" value={a.id} />
                <input
                  type="hidden"
                  name="executedFormId"
                  value={executedFormId}
                />
                <Button variant="destructive" size="sm" type="submit">
                  Remove
                </Button>
              </form>
            </li>
          ))
        )}
      </ul>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Submit form"
      >
        <MonthlyFormSubmit
          executedFormId={executedFormId}
          onSuccess={onSuccess}
        />
      </Drawer>
    </div>
  );
}
