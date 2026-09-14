/**
 * Crew certificate data-access layer (`PROJECT_PLAN.md` §3).
 *
 * Lives in the crew module (not a top-level Certificates twin). Expiry uses
 * {@link deriveComplianceStatus} with a fixed 30d offset rule. Attachments
 * follow the same PDF/JPEG/PNG + 10 MB allow-list as other modules.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  crewCertificateAttachments,
  crewCertificates,
  crewMembers,
  endorsementTypes,
  type CrewCertificateAttachmentRow,
  type CrewCertificateRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { writeAccessLog } from "@/lib/access-log/write";
import { writeActivityLog } from "@/lib/activity-log/write";
import {
  openStoredAttachmentStream,
  removeStoredAttachmentFile,
} from "@/lib/attachments/stream";
import { deriveComplianceStatus, type ComplianceResult } from "@/lib/expiry";
import { logError } from "@/lib/logging";
import {
  CREW_CERTIFICATE_REMINDER_RULE,
  type CrewCertificateListItem,
} from "./crew.model";
import { CrewMemberNotFoundError } from "./scrub-pii";
import type {
  CrewCertificateCreateInput,
  CrewCertificateUpdateInput,
} from "./validation";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export class CrewCertificateNotFoundError extends Error {
  readonly code = "CREW_CERTIFICATE_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Crew certificate not found: ${id}`);
    this.name = "CrewCertificateNotFoundError";
  }
}

export class CrewCertificateConflictError extends Error {
  readonly code = "CREW_CERTIFICATE_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "CrewCertificateConflictError";
  }
}

export class AttachmentValidationError extends Error {
  readonly code = "ATTACHMENT_VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

export class AttachmentNotFoundError extends Error {
  readonly code = "ATTACHMENT_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Attachment not found: ${id}`);
    this.name = "AttachmentNotFoundError";
  }
}

function isPgForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

function deriveForCrewCert(cert: {
  expiryDate: string | null;
}): ComplianceResult {
  return deriveComplianceStatus({
    rule: CREW_CERTIFICATE_REMINDER_RULE,
    expiryDate: cert.expiryDate,
  });
}

async function refreshCachedStatus(
  cert: CrewCertificateRow,
): Promise<void> {
  const compliance = deriveForCrewCert(cert);
  await getDb()
    .update(crewCertificates)
    .set({ cachedStatus: compliance.status, updatedAt: new Date() })
    .where(eq(crewCertificates.id, cert.id));
}

function toListItem(
  cert: CrewCertificateRow,
  endorsementTypeName: string | null,
): CrewCertificateListItem {
  return {
    ...cert,
    endorsementTypeName,
    compliance: deriveForCrewCert(cert),
  };
}

export async function listCrewCertificates(
  ctx: AccessContext,
  crewMemberId: string,
): Promise<CrewCertificateListItem[]> {
  assertAuthenticatedAccess(ctx, crewMemberId);
  const db = getDb();
  const rows = await db
    .select({
      cert: crewCertificates,
      endorsementTypeName: endorsementTypes.name,
    })
    .from(crewCertificates)
    .leftJoin(
      endorsementTypes,
      eq(crewCertificates.endorsementTypeId, endorsementTypes.id),
    )
    .where(eq(crewCertificates.crewMemberId, crewMemberId))
    .orderBy(asc(crewCertificates.name));

  return rows.map((r) => toListItem(r.cert, r.endorsementTypeName));
}

export type GetCrewCertificateOptions = {
  logView?: boolean;
};

export async function getCrewCertificateById(
  ctx: AccessContext,
  id: string,
  options: GetCrewCertificateOptions = {},
): Promise<CrewCertificateListItem | undefined> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const rows = await db
    .select({
      cert: crewCertificates,
      endorsementTypeName: endorsementTypes.name,
    })
    .from(crewCertificates)
    .leftJoin(
      endorsementTypes,
      eq(crewCertificates.endorsementTypeId, endorsementTypes.id),
    )
    .where(eq(crewCertificates.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;

  if (options.logView) {
    await writeAccessLog({
      userId: ctx.userId,
      moduleName: "crew",
      recordId: id,
      accessType: "view",
    });
  }

  return toListItem(row.cert, row.endorsementTypeName);
}

export async function createCrewCertificate(
  ctx: AccessContext,
  input: CrewCertificateCreateInput,
): Promise<CrewCertificateRow> {
  assertAuthenticatedAccess(ctx, input.crewMemberId);
  const db = getDb();

  let row: CrewCertificateRow;
  try {
    const member = await db
      .select({ id: crewMembers.id })
      .from(crewMembers)
      .where(eq(crewMembers.id, input.crewMemberId))
      .limit(1);
    if (!member[0]) throw new CrewMemberNotFoundError(input.crewMemberId);

    const inserted = await db
      .insert(crewCertificates)
      .values({
        crewMemberId: input.crewMemberId,
        name: input.name,
        documentNumber: input.documentNumber ?? null,
        issuingAuthority: input.issuingAuthority ?? null,
        endorsementTypeId: input.endorsementTypeId ?? null,
        issueDate: input.issueDate ?? null,
        expiryDate: input.expiryDate ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) throw new Error("Crew certificate insert did not return a row");
    await refreshCachedStatus(insertedRow);
    row = insertedRow;
  } catch (error) {
    if (error instanceof CrewMemberNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new CrewCertificateConflictError(
        "Crew member or endorsement type reference is invalid.",
      );
    }
    logError("CREW_CERTIFICATE_CREATE_FAILED", { error });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "crew",
    recordId: row.id,
    description: `Added crew certificate: ${row.name}`,
  });
  return row;
}

export async function updateCrewCertificate(
  ctx: AccessContext,
  id: string,
  input: CrewCertificateUpdateInput,
): Promise<CrewCertificateRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const existing = await db
    .select()
    .from(crewCertificates)
    .where(eq(crewCertificates.id, id))
    .limit(1);
  if (!existing[0]) throw new CrewCertificateNotFoundError(id);

  const patch: Partial<typeof crewCertificates.$inferInsert> & {
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.documentNumber !== undefined) {
    patch.documentNumber = input.documentNumber;
  }
  if (input.issuingAuthority !== undefined) {
    patch.issuingAuthority = input.issuingAuthority;
  }
  if (input.endorsementTypeId !== undefined) {
    patch.endorsementTypeId = input.endorsementTypeId;
  }
  if (input.issueDate !== undefined) patch.issueDate = input.issueDate;
  if (input.expiryDate !== undefined) patch.expiryDate = input.expiryDate;
  if (input.notes !== undefined) patch.notes = input.notes;

  let row: CrewCertificateRow;
  try {
    const updated = await db
      .update(crewCertificates)
      .set(patch)
      .where(eq(crewCertificates.id, id))
      .returning();
    const updatedRow = updated[0];
    if (!updatedRow) throw new CrewCertificateNotFoundError(id);
    await refreshCachedStatus(updatedRow);
    row = updatedRow;
  } catch (error) {
    if (error instanceof CrewCertificateNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new CrewCertificateConflictError(
        "Endorsement type reference is invalid.",
      );
    }
    logError("CREW_CERTIFICATE_UPDATE_FAILED", {
      error,
      crewCertificateId: id,
    });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "crew",
    recordId: row.id,
    description: `Updated crew certificate: ${row.name}`,
  });
  return row;
}

export async function deleteCrewCertificate(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const existing = await db
    .select({ name: crewCertificates.name })
    .from(crewCertificates)
    .where(eq(crewCertificates.id, id))
    .limit(1);
  const name = existing[0]?.name;
  try {
    const atts = await db
      .select()
      .from(crewCertificateAttachments)
      .where(eq(crewCertificateAttachments.crewCertificateId, id));
    for (const att of atts) {
      await removeStoredAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(crewCertificates)
      .where(eq(crewCertificates.id, id))
      .returning({ id: crewCertificates.id });
    if (deleted.length === 0) throw new CrewCertificateNotFoundError(id);
  } catch (error) {
    if (error instanceof CrewCertificateNotFoundError) throw error;
    logError("CREW_CERTIFICATE_DELETE_FAILED", {
      error,
      crewCertificateId: id,
    });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "crew",
    recordId: id,
    description: name
      ? `Deleted crew certificate: ${name}`
      : "Deleted crew certificate",
  });
}

export async function listCrewCertificateAttachments(
  ctx: AccessContext,
  crewCertificateId: string,
): Promise<CrewCertificateAttachmentRow[]> {
  assertAuthenticatedAccess(ctx, crewCertificateId);
  return getDb()
    .select()
    .from(crewCertificateAttachments)
    .where(eq(crewCertificateAttachments.crewCertificateId, crewCertificateId))
    .orderBy(asc(crewCertificateAttachments.uploadedAt));
}

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

export async function uploadCrewCertificateAttachment(
  ctx: AccessContext,
  crewCertificateId: string,
  file: { name: string; type: string; size: number; bytes: Buffer },
): Promise<CrewCertificateAttachmentRow> {
  assertAuthenticatedAccess(ctx, crewCertificateId);

  if (!ALLOWED_MIME.has(file.type)) {
    throw new AttachmentValidationError(
      "Only PDF, JPEG, and PNG attachments are allowed.",
    );
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentValidationError(
      "Attachment must be between 1 byte and 10 MB.",
    );
  }

  const db = getDb();
  let row: CrewCertificateAttachmentRow;
  try {
    const parent = await db
      .select({ id: crewCertificates.id })
      .from(crewCertificates)
      .where(eq(crewCertificates.id, crewCertificateId))
      .limit(1);
    if (!parent[0]) throw new CrewCertificateNotFoundError(crewCertificateId);

    await mkdir(ATTACHMENTS_DIR, { recursive: true });
    const id = randomUUID();
    const storedName = `${id}${extensionForMime(file.type)}`;
    const absolute = path.join(ATTACHMENTS_DIR, storedName);
    const relativePath = path
      .join("data", "attachments", storedName)
      .replace(/\\/g, "/");
    await writeFile(absolute, file.bytes);

    const inserted = await db
      .insert(crewCertificateAttachments)
      .values({
        id,
        crewCertificateId,
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
      error instanceof CrewCertificateNotFoundError ||
      error instanceof AttachmentValidationError
    ) {
      throw error;
    }
    logError("CREW_CERTIFICATE_ATTACHMENT_UPLOAD_FAILED", {
      error,
      crewCertificateId,
    });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "uploaded",
    moduleName: "crew",
    recordId: crewCertificateId,
    description: `Uploaded attachment to crew certificate: ${row.fileName}`,
  });
  return row;
}

export async function deleteCrewCertificateAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(crewCertificateAttachments)
      .where(eq(crewCertificateAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AttachmentNotFoundError(attachmentId);
    await db
      .delete(crewCertificateAttachments)
      .where(eq(crewCertificateAttachments.id, attachmentId));
    await removeStoredAttachmentFile(row.filePath);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    logError("CREW_CERTIFICATE_ATTACHMENT_DELETE_FAILED", {
      error,
      attachmentId,
    });
    throw error;
  }
}

/**
 * Lookup for the generic `/api/attachments/[id]` resolver.
 * Does not write access_logs — the resolver/route logs download_attachment.
 */
export async function getCrewCertificateAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<
  | (CrewCertificateAttachmentRow & { crewCertificateId: string })
  | undefined
> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const rows = await getDb()
    .select()
    .from(crewCertificateAttachments)
    .where(eq(crewCertificateAttachments.id, attachmentId))
    .limit(1);
  return rows[0];
}

/** Opens a stream after path-escape check (module-local / tests). */
export async function openCrewCertificateAttachmentStream(
  ctx: AccessContext,
  attachmentId: string,
): Promise<{
  row: CrewCertificateAttachmentRow;
  stream: NodeJS.ReadableStream;
}> {
  const row = await getCrewCertificateAttachmentById(ctx, attachmentId);
  if (!row) throw new AttachmentNotFoundError(attachmentId);
  try {
    const { stream } = openStoredAttachmentStream(row.filePath);
    return { row, stream };
  } catch {
    throw new AttachmentNotFoundError(attachmentId);
  }
}
