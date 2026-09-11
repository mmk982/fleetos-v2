/**
 * Certificate data-access layer.
 *
 * Only file in this module allowed to import drizzle-orm query builders.
 * Every public method takes {@link AccessContext} and calls
 * {@link assertAuthenticatedAccess}. Live status always comes from
 * `deriveComplianceStatus` — `cachedStatus` is a non-authoritative write-side cache.
 *
 * Spec: PROJECT_PLAN.md §1.
 */
import "server-only";

import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  certificateAttachments,
  certificateEvents,
  certificates,
  certificateTypes,
  issuingAuthorities,
  vessels,
  type CertificateAttachmentRow,
  type CertificateEventRow,
  type CertificateRow,
  type CertificateTypeRow,
  type IssuingAuthorityRow,
  type VesselRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import {
  deriveComplianceStatus,
  type ComplianceResult,
  type ComplianceStatus,
} from "@/lib/expiry";
import { logError } from "@/lib/logging";
import { effectiveOffsetDays } from "./certificate.model";
import type {
  CertificateCreateInput,
  CertificateEventCreateInput,
  CertificateUpdateInput,
} from "./validation";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export class CertificateNotFoundError extends Error {
  readonly code = "CERTIFICATE_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Certificate not found: ${id}`);
    this.name = "CertificateNotFoundError";
  }
}

export class CertificateTypeNotFoundError extends Error {
  readonly code = "CERTIFICATE_TYPE_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Certificate type not found: ${id}`);
    this.name = "CertificateTypeNotFoundError";
  }
}

export class CertificateConflictError extends Error {
  readonly code = "CERTIFICATE_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "CertificateConflictError";
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

function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

function isPgForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

/** List-row shape with joins + live compliance. */
export type CertificateListItem = CertificateRow & {
  vesselName: string;
  typeName: string;
  authority: CertificateTypeRow["authority"];
  ruleKind: CertificateTypeRow["ruleKind"];
  typeOffsetDays: number | null;
  issuingAuthorityName: string | null;
  compliance: ComplianceResult;
};

/** Detail shape including events and attachments. */
export type CertificateDetail = CertificateListItem & {
  events: CertificateEventRow[];
  attachments: CertificateAttachmentRow[];
  certificateType: CertificateTypeRow;
  issuingAuthority: IssuingAuthorityRow | null;
  vessel: VesselRow;
};

export type CertificateListFilters = {
  vesselId?: string;
  authority?: string;
  issuingAuthorityId?: string;
  /** Live engine status filter (applied after derive). */
  status?: ComplianceStatus;
};

function deriveForCertificate(
  cert: CertificateRow,
  type: Pick<CertificateTypeRow, "ruleKind" | "offsetDays">,
): ComplianceResult {
  const offsetDays = effectiveOffsetDays(cert, type.offsetDays);
  return deriveComplianceStatus({
    rule: { kind: type.ruleKind, offsetDays },
    expiryDate: cert.expiryDate,
    windowOpenDate: cert.windowOpenDate,
    windowCloseDate: cert.windowCloseDate,
    lifecycleStatus: cert.lifecycleStatus,
  });
}

async function loadType(
  ctx: AccessContext,
  id: string,
): Promise<CertificateTypeRow> {
  assertAuthenticatedAccess(ctx);
  const rows = await getDb()
    .select()
    .from(certificateTypes)
    .where(eq(certificateTypes.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new CertificateTypeNotFoundError(id);
  }
  return row;
}

/** Recomputes and persists non-authoritative `cachedStatus`. */
async function refreshCachedStatus(
  ctx: AccessContext,
  cert: CertificateRow,
  type: Pick<CertificateTypeRow, "ruleKind" | "offsetDays">,
): Promise<ComplianceStatus> {
  assertAuthenticatedAccess(ctx);
  const compliance = deriveForCertificate(cert, type);
  await getDb()
    .update(certificates)
    .set({ cachedStatus: compliance.status, updatedAt: new Date() })
    .where(eq(certificates.id, cert.id));
  return compliance.status;
}

/** Certificate types for form dropdowns, grouped by authority at the UI layer. */
export async function listCertificateTypes(
  ctx: AccessContext,
): Promise<CertificateTypeRow[]> {
  assertAuthenticatedAccess(ctx);
  return getDb()
    .select()
    .from(certificateTypes)
    .orderBy(asc(certificateTypes.authority), asc(certificateTypes.name));
}

/** Issuing authorities for form dropdowns / filters. */
export async function listIssuingAuthorities(
  ctx: AccessContext,
): Promise<IssuingAuthorityRow[]> {
  assertAuthenticatedAccess(ctx);
  return getDb()
    .select()
    .from(issuingAuthorities)
    .orderBy(asc(issuingAuthorities.name));
}

/**
 * Lists certificates with vessel/type/issuer joins and live compliance status.
 *
 * @param filters - Optional vessel / authority / issuer / live-status filters.
 */
export async function listCertificates(
  ctx: AccessContext,
  filters: CertificateListFilters = {},
): Promise<CertificateListItem[]> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();

  const conditions: SQL[] = [];
  if (filters.vesselId) {
    conditions.push(eq(certificates.vesselId, filters.vesselId));
  }
  if (filters.authority) {
    conditions.push(
      eq(certificateTypes.authority, filters.authority as CertificateTypeRow["authority"]),
    );
  }
  if (filters.issuingAuthorityId) {
    conditions.push(eq(certificates.issuingAuthorityId, filters.issuingAuthorityId));
  }

  const rows = await db
    .select({
      certificate: certificates,
      vesselName: vessels.name,
      typeName: certificateTypes.name,
      authority: certificateTypes.authority,
      ruleKind: certificateTypes.ruleKind,
      typeOffsetDays: certificateTypes.offsetDays,
      issuingAuthorityName: issuingAuthorities.name,
    })
    .from(certificates)
    .innerJoin(vessels, eq(certificates.vesselId, vessels.id))
    .innerJoin(
      certificateTypes,
      eq(certificates.certificateTypeId, certificateTypes.id),
    )
    .leftJoin(
      issuingAuthorities,
      eq(certificates.issuingAuthorityId, issuingAuthorities.id),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(vessels.name), asc(certificateTypes.name));

  const items: CertificateListItem[] = rows.map((row) => {
    const compliance = deriveForCertificate(row.certificate, {
      ruleKind: row.ruleKind,
      offsetDays: row.typeOffsetDays,
    });
    return {
      ...row.certificate,
      vesselName: row.vesselName,
      typeName: row.typeName,
      authority: row.authority,
      ruleKind: row.ruleKind,
      typeOffsetDays: row.typeOffsetDays,
      issuingAuthorityName: row.issuingAuthorityName,
      compliance,
    };
  });

  if (filters.status) {
    return items.filter((item) => item.compliance.status === filters.status);
  }
  return items;
}

/**
 * Full certificate detail, or `undefined` if missing.
 */
export async function getCertificateById(
  ctx: AccessContext,
  id: string,
): Promise<CertificateDetail | undefined> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const rows = await db
    .select({
      certificate: certificates,
      vessel: vessels,
      certificateType: certificateTypes,
      issuingAuthority: issuingAuthorities,
    })
    .from(certificates)
    .innerJoin(vessels, eq(certificates.vesselId, vessels.id))
    .innerJoin(
      certificateTypes,
      eq(certificates.certificateTypeId, certificateTypes.id),
    )
    .leftJoin(
      issuingAuthorities,
      eq(certificates.issuingAuthorityId, issuingAuthorities.id),
    )
    .where(eq(certificates.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return undefined;
  }

  const [events, attachments] = await Promise.all([
    db
      .select()
      .from(certificateEvents)
      .where(eq(certificateEvents.certificateId, id))
      .orderBy(desc(certificateEvents.eventDate), desc(certificateEvents.createdAt)),
    db
      .select()
      .from(certificateAttachments)
      .where(eq(certificateAttachments.certificateId, id))
      .orderBy(desc(certificateAttachments.uploadedAt)),
  ]);

  const compliance = deriveForCertificate(row.certificate, row.certificateType);

  return {
    ...row.certificate,
    vesselName: row.vessel.name,
    typeName: row.certificateType.name,
    authority: row.certificateType.authority,
    ruleKind: row.certificateType.ruleKind,
    typeOffsetDays: row.certificateType.offsetDays,
    issuingAuthorityName: row.issuingAuthority?.name ?? null,
    compliance,
    events,
    attachments,
    certificateType: row.certificateType,
    issuingAuthority: row.issuingAuthority,
    vessel: row.vessel,
  };
}

/** @throws {CertificateNotFoundError} */
export async function requireCertificateById(
  ctx: AccessContext,
  id: string,
): Promise<CertificateDetail> {
  const row = await getCertificateById(ctx, id);
  if (!row) {
    throw new CertificateNotFoundError(id);
  }
  return row;
}

/**
 * Creates a certificate and writes `cachedStatus` from the engine.
 *
 * @throws {CertificateTypeNotFoundError}
 * @throws {CertificateConflictError} on FK / unique violations
 */
export async function createCertificate(
  ctx: AccessContext,
  input: CertificateCreateInput,
): Promise<CertificateRow> {
  assertAuthenticatedAccess(ctx);
  const type = await loadType(ctx, input.certificateTypeId);
  const db = getDb();

  try {
    const inserted = await db
      .insert(certificates)
      .values({
        vesselId: input.vesselId,
        certificateTypeId: input.certificateTypeId,
        certificateNumber: input.certificateNumber ?? null,
        issuingAuthorityId: input.issuingAuthorityId ?? null,
        issueDate: input.issueDate ?? null,
        expiryDate: input.expiryDate ?? null,
        windowOpenDate: input.windowOpenDate ?? null,
        windowCloseDate: input.windowCloseDate ?? null,
        linkedToDryDock: input.linkedToDryDock,
        customOffsetDays: input.customOffsetDays ?? null,
        lifecycleStatus: input.lifecycleStatus,
        remarks: input.remarks ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) {
      throw new Error("Insert did not return a row");
    }
    await refreshCachedStatus(ctx, row, type);
    const refreshed = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, row.id))
      .limit(1);
    return refreshed[0] ?? row;
  } catch (error) {
    if (error instanceof CertificateTypeNotFoundError) {
      throw error;
    }
    if (isPgForeignKeyViolation(error)) {
      throw new CertificateConflictError(
        "Vessel, certificate type, or issuing authority reference is invalid.",
      );
    }
    if (isPgUniqueViolation(error)) {
      throw new CertificateConflictError("Certificate conflicts with an existing row.");
    }
    logError("CERTIFICATE_CREATE_FAILED", {
      error,
      vesselId: input.vesselId,
      certificateTypeId: input.certificateTypeId,
    });
    throw error;
  }
}

/**
 * Partial update; recomputes `cachedStatus` afterward.
 *
 * @throws {CertificateNotFoundError}
 */
export async function updateCertificate(
  ctx: AccessContext,
  id: string,
  input: CertificateUpdateInput,
): Promise<CertificateRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const existing = await db
    .select()
    .from(certificates)
    .where(eq(certificates.id, id))
    .limit(1);
  if (!existing[0]) {
    throw new CertificateNotFoundError(id);
  }

  const patch: Partial<typeof certificates.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.certificateTypeId !== undefined) {
    patch.certificateTypeId = input.certificateTypeId;
  }
  if (input.issuingAuthorityId !== undefined) {
    patch.issuingAuthorityId = input.issuingAuthorityId;
  }
  if (input.certificateNumber !== undefined) {
    patch.certificateNumber = input.certificateNumber;
  }
  if (input.issueDate !== undefined) patch.issueDate = input.issueDate;
  if (input.expiryDate !== undefined) patch.expiryDate = input.expiryDate;
  if (input.windowOpenDate !== undefined) {
    patch.windowOpenDate = input.windowOpenDate;
  }
  if (input.windowCloseDate !== undefined) {
    patch.windowCloseDate = input.windowCloseDate;
  }
  if (input.linkedToDryDock !== undefined) {
    patch.linkedToDryDock = input.linkedToDryDock;
  }
  if (input.customOffsetDays !== undefined) {
    patch.customOffsetDays = input.customOffsetDays;
  }
  if (input.lifecycleStatus !== undefined) {
    patch.lifecycleStatus = input.lifecycleStatus;
  }
  if (input.remarks !== undefined) patch.remarks = input.remarks;

  try {
    const updated = await db
      .update(certificates)
      .set(patch)
      .where(eq(certificates.id, id))
      .returning();
    const row = updated[0];
    if (!row) {
      throw new CertificateNotFoundError(id);
    }
    const type = await loadType(ctx, row.certificateTypeId);
    await refreshCachedStatus(ctx, row, type);
    const refreshed = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id))
      .limit(1);
    return refreshed[0] ?? row;
  } catch (error) {
    if (
      error instanceof CertificateNotFoundError ||
      error instanceof CertificateTypeNotFoundError
    ) {
      throw error;
    }
    if (isPgForeignKeyViolation(error)) {
      throw new CertificateConflictError(
        "Vessel, certificate type, or issuing authority reference is invalid.",
      );
    }
    logError("CERTIFICATE_UPDATE_FAILED", { error, certificateId: id });
    throw error;
  }
}

/**
 * Hard-deletes a certificate (mistake cleanup only — normal path uses revoke).
 * Events/attachments cascade at the DB.
 *
 * @throws {CertificateNotFoundError}
 */
export async function deleteCertificate(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  try {
    const existing = await db
      .select()
      .from(certificateAttachments)
      .where(eq(certificateAttachments.certificateId, id));
    for (const att of existing) {
      await removeAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(certificates)
      .where(eq(certificates.id, id))
      .returning({ id: certificates.id });
    if (deleted.length === 0) {
      throw new CertificateNotFoundError(id);
    }
  } catch (error) {
    if (error instanceof CertificateNotFoundError) {
      throw error;
    }
    logError("CERTIFICATE_DELETE_FAILED", { error, certificateId: id });
    throw error;
  }
}

/**
 * Adds a history event. `extended`/`renewed` push `expiryDate`;
 * `revoked` sets `lifecycleStatus`. Then recomputes `cachedStatus`.
 */
export async function addCertificateEvent(
  ctx: AccessContext,
  input: CertificateEventCreateInput,
): Promise<CertificateEventRow> {
  assertAuthenticatedAccess(ctx, input.certificateId);
  const db = getDb();

  try {
    const certRows = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, input.certificateId))
      .limit(1);
    const cert = certRows[0];
    if (!cert) {
      throw new CertificateNotFoundError(input.certificateId);
    }

    const inserted = await db
      .insert(certificateEvents)
      .values({
        certificateId: input.certificateId,
        eventType: input.eventType,
        eventDate: input.eventDate,
        newExpiryDate: input.newExpiryDate ?? null,
        note: input.note ?? null,
      })
      .returning();
    const event = inserted[0];
    if (!event) {
      throw new Error("Event insert did not return a row");
    }

    const patch: Partial<typeof certificates.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (
      (input.eventType === "extended" || input.eventType === "renewed") &&
      input.newExpiryDate
    ) {
      patch.expiryDate = input.newExpiryDate;
    }
    if (input.eventType === "revoked") {
      patch.lifecycleStatus = "revoked";
    }

    const updated = await db
      .update(certificates)
      .set(patch)
      .where(eq(certificates.id, cert.id))
      .returning();
    const next = updated[0] ?? cert;
    const type = await loadType(ctx, next.certificateTypeId);
    await refreshCachedStatus(ctx, next, type);
    return event;
  } catch (error) {
    if (error instanceof CertificateNotFoundError) {
      throw error;
    }
    logError("CERTIFICATE_EVENT_FAILED", {
      error,
      certificateId: input.certificateId,
    });
    throw error;
  }
}

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

async function removeAttachmentFile(relativePath: string): Promise<void> {
  const absolute = path.join(process.cwd(), relativePath);
  const root = path.join(process.cwd(), "data", "attachments");
  if (!absolute.startsWith(root)) {
    return;
  }
  try {
    await unlink(absolute);
  } catch {
    // File may already be gone — ignore.
  }
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
  assertAuthenticatedAccess(ctx, certificateId);

  if (!ALLOWED_MIME.has(file.type)) {
    throw new AttachmentValidationError(
      "Only PDF, JPEG, and PNG attachments are allowed.",
    );
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentValidationError("Attachment must be between 1 byte and 10 MB.");
  }

  const db = getDb();
  try {
    const cert = await db
      .select({ id: certificates.id })
      .from(certificates)
      .where(eq(certificates.id, certificateId))
      .limit(1);
    if (!cert[0]) {
      throw new CertificateNotFoundError(certificateId);
    }

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
    const row = inserted[0];
    if (!row) {
      await unlink(absolute).catch(() => undefined);
      throw new Error("Attachment insert did not return a row");
    }
    return row;
  } catch (error) {
    if (
      error instanceof CertificateNotFoundError ||
      error instanceof AttachmentValidationError
    ) {
      throw error;
    }
    logError("CERTIFICATE_ATTACHMENT_UPLOAD_FAILED", {
      error,
      certificateId,
    });
    throw error;
  }
}

/** Deletes an attachment row and its on-disk file. */
export async function deleteCertificateAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(certificateAttachments)
      .where(eq(certificateAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new AttachmentNotFoundError(attachmentId);
    }
    await db
      .delete(certificateAttachments)
      .where(eq(certificateAttachments.id, attachmentId));
    await removeAttachmentFile(row.filePath);
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
}

/**
 * Looks up an attachment for the authenticated download route.
 * Path is taken only from the DB row — never from the request.
 */
export async function getCertificateAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<CertificateAttachmentRow | undefined> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const rows = await getDb()
    .select()
    .from(certificateAttachments)
    .where(eq(certificateAttachments.id, attachmentId))
    .limit(1);
  return rows[0];
}

/**
 * Opens a read stream for an attachment after validating the stored path
 * stays under `data/attachments/`.
 */
export async function openAttachmentStream(
  ctx: AccessContext,
  attachmentId: string,
): Promise<{ row: CertificateAttachmentRow; stream: NodeJS.ReadableStream }> {
  const row = await getCertificateAttachmentById(ctx, attachmentId);
  if (!row) {
    throw new AttachmentNotFoundError(attachmentId);
  }
  const absolute = path.resolve(process.cwd(), row.filePath);
  const root = path.resolve(process.cwd(), "data", "attachments");
  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    logError("ATTACHMENT_PATH_ESCAPE", { attachmentId, filePath: row.filePath });
    throw new AttachmentNotFoundError(attachmentId);
  }
  return { row, stream: createReadStream(absolute) };
}
