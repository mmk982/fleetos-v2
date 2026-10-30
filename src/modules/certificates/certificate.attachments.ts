import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, withDb } from "@/db/client";
import {
  certificateAttachments,
  certificates,
  type CertificateAttachmentRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  assertVesselScope,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import {
  openStoredAttachmentStream,
  removeStoredAttachmentFile,
} from "@/lib/attachments/stream";
import { isPgForeignKeyViolation } from "@/lib/db/pg-errors";
import { logError } from "@/lib/logging";
import {
  AttachmentNotFoundError,
  AttachmentValidationError,
  CertificateConflictError,
  CertificateNotFoundError,
} from "./certificate.shared";
const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

async function removeAttachmentFile(relativePath: string): Promise<void> {
  await removeStoredAttachmentFile(relativePath);
}

/**
 * Stores an uploaded file under `data/attachments/` with a generated name
 * (never derived from the user-supplied filename — SECURITY_PLAN.md §6).
 */
export async function uploadCertificateAttachment(
  ctx: AccessContext,
  certificateId: string,
  file: { name: string; type: string; size: number; bytes: Buffer },
): Promise<CertificateAttachmentRow> {
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx, certificateId);
    assertModuleAccess(ctx, "certificates", "write");
  
    if (!ALLOWED_MIME.has(file.type)) {
      throw new AttachmentValidationError(
        "Only PDF, JPEG, and PNG attachments are allowed.",
      );
    }
    if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
      throw new AttachmentValidationError("Attachment must be between 1 byte and 10 MB.");
    }
  
    const db = getDb();
    let row: CertificateAttachmentRow;
    try {
      const cert = await db
        .select({ id: certificates.id, vesselId: certificates.vesselId })
        .from(certificates)
        .where(eq(certificates.id, certificateId))
        .limit(1);
      if (!cert[0]) {
        throw new CertificateNotFoundError(certificateId);
      }
      assertVesselScope(ctx, cert[0].vesselId);
  
      await mkdir(ATTACHMENTS_DIR, { recursive: true });
      const id = randomUUID();
      const storedName = `${id}${extensionForMime(file.type)}`;
      const absolute = path.join(ATTACHMENTS_DIR, storedName);
      const relativePath = path.join("data", "attachments", storedName).replace(/\\/g, "/");
      await writeFile(absolute, file.bytes);
  
      const inserted = await db
        .insert(certificateAttachments)
        .values({
          id,
          certificateId,
          fileName: file.name.slice(0, 255) || storedName,
          filePath: relativePath,
          uploadedBy: ctx.userId,
        })
        .returning();
      const insertedRow = inserted[0];
      if (!insertedRow) {
        await removeStoredAttachmentFile(relativePath);
        throw new Error("Attachment insert did not return a row");
      }
      row = insertedRow;
    } catch (error) {
      if (
        error instanceof CertificateNotFoundError ||
        error instanceof AttachmentValidationError
      ) {
        throw error;
      }
      if (isPgForeignKeyViolation(error)) {
        throw new CertificateConflictError(
          "Cannot upload attachment: certificate or uploader reference is invalid.",
        );
      }
      logError("CERTIFICATE_ATTACHMENT_UPLOAD_FAILED", {
        error,
        certificateId,
      });
      throw error;
    }
    await writeActivityLog({
      userId: ctx.userId,
      actionType: "uploaded",
      moduleName: "certificate",
      recordId: certificateId,
      description: `Uploaded attachment to certificate: ${row.fileName}`,
    });
    return row;
  
  });
}

/** Deletes an attachment row and its on-disk file. */
export async function deleteCertificateAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx, attachmentId);
    assertModuleAccess(ctx, "certificates", "write");
    const db = getDb();
    try {
      const rows = await db
        .select({
          attachment: certificateAttachments,
          vesselId: certificates.vesselId,
        })
        .from(certificateAttachments)
        .innerJoin(
          certificates,
          eq(certificateAttachments.certificateId, certificates.id),
        )
        .where(eq(certificateAttachments.id, attachmentId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new AttachmentNotFoundError(attachmentId);
      }
      assertVesselScope(ctx, row.vesselId);
      await db
        .delete(certificateAttachments)
        .where(eq(certificateAttachments.id, attachmentId));
      await removeAttachmentFile(row.attachment.filePath);
    } catch (error) {
      if (error instanceof AttachmentNotFoundError) {
        throw error;
      }
      logError("CERTIFICATE_ATTACHMENT_DELETE_FAILED", {
        error,
        attachmentId,
      });
      throw error;
    }
  
  });
}

/**
 * Looks up an attachment for the authenticated download route.
 * Path is taken only from the DB row — never from the request.
 */
export async function getCertificateAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<CertificateAttachmentRow | undefined> {
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx, attachmentId);
    assertModuleAccess(ctx, "certificates", "read");
    const rows = await getDb()
      .select({
        attachment: certificateAttachments,
        vesselId: certificates.vesselId,
      })
      .from(certificateAttachments)
      .innerJoin(
        certificates,
        eq(certificateAttachments.certificateId, certificates.id),
      )
      .where(eq(certificateAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return undefined;
    }
    assertVesselScope(ctx, row.vesselId);
    return row.attachment;
  
  });
}

/**
 * Opens a read stream for an attachment after validating the stored path
 * stays under `data/attachments/`. Prefer the generic `/api/attachments/[id]`
 * resolver for new call sites.
 */
export async function openAttachmentStream(
  ctx: AccessContext,
  attachmentId: string,
): Promise<{ row: CertificateAttachmentRow; stream: NodeJS.ReadableStream }> {
  return withDb(ctx, async () => {
    const row = await getCertificateAttachmentById(ctx, attachmentId);
    if (!row) {
      throw new AttachmentNotFoundError(attachmentId);
    }
    try {
      const { stream } = openStoredAttachmentStream(row.filePath);
      return { row, stream };
    } catch {
      throw new AttachmentNotFoundError(attachmentId);
    }
  
  });
}
