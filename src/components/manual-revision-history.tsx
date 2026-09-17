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
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
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

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-page)] text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              <th className="px-4 py-3 font-medium">Revision</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Uploaded by</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {revisions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--text-tertiary)]"
                >
                  No revisions yet.
                </td>
              </tr>
            ) : (
              revisions.map((r) => (
                <tr key={r.id} className="bg-[var(--bg-card)]">
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    {r.revisionNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
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
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
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
