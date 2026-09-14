"use client";

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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Attachments
        </h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Submit / upload
        </button>
      </div>

      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {attachments.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">
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
                <button
                  type="submit"
                  className="text-xs font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-300"
                >
                  Remove
                </button>
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
