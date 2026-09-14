/**
 * Cross-module attachment lookup for `/api/attachments/[id]`.
 *
 * Decision (Task 5.3): **genericize** the existing route rather than add a
 * parallel `/api/deficiency-attachments/[id]`. MASTER_IMPLEMENTATION_PLAN
 * Task 5.2 already framed `/api/attachments/[id]` as the single authenticated
 * serve path every module reuses; Certificates was only the first table.
 * UUIDs are unique across tables, so we try each attachments table in turn
 * and stream via the shared path-escape helper — no discriminator column
 * needed on disk or in the URL.
 */
import "server-only";

import type { AccessContext } from "@/lib/auth/access";
import { openStoredAttachmentStream } from "@/lib/attachments/stream";
import { getCertificateAttachmentById } from "@/modules/certificates/certificate.controller";
import { getDeficiencyAttachmentById } from "@/modules/deficiencies/deficiency.controller";

export type ResolvedAttachment = {
  fileName: string;
  filePath: string;
  stream: NodeJS.ReadableStream;
};

export class AttachmentNotFoundError extends Error {
  readonly code = "ATTACHMENT_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Attachment not found: ${id}`);
    this.name = "AttachmentNotFoundError";
  }
}

/**
 * Resolves an attachment id against known `*_attachments` tables and opens
 * a stream. Path always comes from the DB row.
 */
export async function resolveAttachmentStream(
  ctx: AccessContext,
  attachmentId: string,
): Promise<ResolvedAttachment> {
  const cert = await getCertificateAttachmentById(ctx, attachmentId);
  if (cert) {
    const { stream } = openStoredAttachmentStream(cert.filePath);
    return { fileName: cert.fileName, filePath: cert.filePath, stream };
  }

  const def = await getDeficiencyAttachmentById(ctx, attachmentId);
  if (def) {
    const { stream } = openStoredAttachmentStream(def.filePath);
    return { fileName: def.fileName, filePath: def.filePath, stream };
  }

  throw new AttachmentNotFoundError(attachmentId);
}
