"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ManualRevisionUpload } from "@/components/manual-revision-upload";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import { setCurrentRevisionFormAction } from "@/modules/manuals/actions";
import type { ManualRevisionRow } from "@/db/schema";

export function ManualRevisionHistory({
  manualId,
  revisions,
}: {
  manualId: string;
  revisions: ManualRevisionRow[];
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);

  const onUploadSuccess = useCallback(() => {
    setUploadOpen(false);
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Revision history
        </h2>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Upload new revision
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">Revision</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Uploaded by</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {revisions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  No revisions yet.
                </td>
              </tr>
            ) : (
              revisions.map((r) => (
                <tr key={r.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    {r.revisionNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {r.revisionDate ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/attachments/${r.id}`}
                      className="font-medium text-[#378ADD] underline-offset-2 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Identifier>{r.fileName}</Identifier>
                    </a>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {r.uploadedBy ? (
                      <Identifier>{r.uploadedBy.slice(0, 8)}</Identifier>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.isCurrentVersion ? (
                      <StatusPill tone="success">Current</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Previous</StatusPill>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!r.isCurrentVersion ? (
                      <form action={setCurrentRevisionFormAction}>
                        <input type="hidden" name="manualId" value={manualId} />
                        <input
                          type="hidden"
                          name="revisionId"
                          value={r.id}
                        />
                        <button
                          type="submit"
                          className="text-xs font-medium text-[#378ADD] underline-offset-2 hover:underline"
                        >
                          Set current
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload new revision"
      >
        <ManualRevisionUpload
          manualId={manualId}
          onSuccess={onUploadSuccess}
        />
      </Drawer>
    </div>
  );
}
