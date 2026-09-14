/**
 * Cross-module attachment lookup for `/api/attachments/[id]`.
 *
 * Decision (Task 5.3): **genericize** the existing route rather than add
 * parallel per-module download URLs. Try each `*_attachments` table in turn
 * (certificates → deficiencies → crew certificates → insurance →
 * ISM templates → manual revisions). UUIDs are unique across tables; path
 * always comes from the DB row.
 *
 * Crew attachment hits also write a GDPR `access_logs` row
 * (`download_attachment`) — see PROJECT_PLAN.md §6. Insurance, ISM
 * templates, and manual revisions do **not** (SECURITY_PLAN.md §6b is
 * Crew-only).
 */
import "server-only";

import type { AccessContext } from "@/lib/auth/access";
import { writeAccessLog } from "@/lib/access-log/write";
import { openStoredAttachmentStream } from "@/lib/attachments/stream";
import { getCertificateAttachmentById } from "@/modules/certificates/certificate.controller";
import { getDeficiencyAttachmentById } from "@/modules/deficiencies/deficiency.controller";
import { getCrewCertificateAttachmentById } from "@/modules/crew/crew-certificate.controller";
import { getInsuranceAttachmentById } from "@/modules/insurance/insurance.controller";
import { getIsmTemplateAttachmentById } from "@/modules/ism-templates/ismTemplate.controller";
import { getManualRevisionAttachmentById } from "@/modules/manuals/manual.controller";

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

  const crew = await getCrewCertificateAttachmentById(ctx, attachmentId);
  if (crew) {
    await writeAccessLog({
      userId: ctx.userId,
      moduleName: "crew",
      recordId: crew.crewCertificateId,
      accessType: "download_attachment",
    });
    const { stream } = openStoredAttachmentStream(crew.filePath);
    return { fileName: crew.fileName, filePath: crew.filePath, stream };
  }

  const insurance = await getInsuranceAttachmentById(ctx, attachmentId);
  if (insurance) {
    const { stream } = openStoredAttachmentStream(insurance.filePath);
    return {
      fileName: insurance.fileName,
      filePath: insurance.filePath,
      stream,
    };
  }

  const ism = await getIsmTemplateAttachmentById(ctx, attachmentId);
  if (ism) {
    const { stream } = openStoredAttachmentStream(ism.filePath);
    return { fileName: ism.fileName, filePath: ism.filePath, stream };
  }

  const manualRev = await getManualRevisionAttachmentById(ctx, attachmentId);
  if (manualRev) {
    const { stream } = openStoredAttachmentStream(manualRev.filePath);
    return {
      fileName: manualRev.fileName,
      filePath: manualRev.filePath,
      stream,
    };
  }

  throw new AttachmentNotFoundError(attachmentId);
}
