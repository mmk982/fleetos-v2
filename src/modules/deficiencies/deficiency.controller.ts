/**
 * Deficiency data-access layer.
 *
 * Only file in this module allowed to import drizzle-orm query builders.
 * Status is a stored column — transition helpers enforce the §2 actions
 * (`close` / `reopen` / `startProgress` / `setMonitoring`) rather than
 * inventing free-form status patches for those flows.
 *
 * Spec: PROJECT_PLAN.md §2.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  deficiencies,
  deficiencyAttachments,
  vessels,
  type DeficiencyAttachmentRow,
  type DeficiencyRow,
  type DeficiencyStatus,
  type VesselRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import {
  openStoredAttachmentStream,
  removeStoredAttachmentFile,
} from "@/lib/attachments/stream";
import { logError } from "@/lib/logging";
import type { DeficiencyListItem } from "./deficiency.model";
import type {
  DeficiencyCreateInput,
  DeficiencyUpdateInput,
} from "./validation";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export class DeficiencyNotFoundError extends Error {
  readonly code = "DEFICIENCY_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Deficiency not found: ${id}`);
    this.name = "DeficiencyNotFoundError";
  }
}

export class DeficiencyConflictError extends Error {
  readonly code = "DEFICIENCY_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "DeficiencyConflictError";
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type DeficiencyListFilters = {
  vesselId?: string;
  status?: DeficiencyStatus;
  source?: string;
  category?: string;
};

export type DeficiencyDetail = DeficiencyListItem & {
  attachments: DeficiencyAttachmentRow[];
  vessel: VesselRow;
};

/** Lists deficiencies with vessel name, optional filters. */
export async function listDeficiencies(
  ctx: AccessContext,
  filters: DeficiencyListFilters = {},
): Promise<DeficiencyListItem[]> {
  assertAuthenticatedAccess(ctx);
  const conditions: SQL[] = [];
  if (filters.vesselId) {
    conditions.push(eq(deficiencies.vesselId, filters.vesselId));
  }
  if (filters.status) {
    conditions.push(eq(deficiencies.status, filters.status));
  }
  if (filters.source) {
    conditions.push(
      eq(deficiencies.source, filters.source as DeficiencyRow["source"]),
    );
  }
  if (filters.category) {
    conditions.push(eq(deficiencies.category, filters.category));
  }

  const rows = await getDb()
    .select({
      deficiency: deficiencies,
      vesselName: vessels.name,
    })
    .from(deficiencies)
    .innerJoin(vessels, eq(deficiencies.vesselId, vessels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(vessels.name), desc(deficiencies.dueDate), asc(deficiencies.title));

  return rows.map((row) => ({
    ...row.deficiency,
    vesselName: row.vesselName,
  }));
}

/** Detail with attachments, or `undefined` if missing. */
export async function getDeficiencyById(
  ctx: AccessContext,
  id: string,
): Promise<DeficiencyDetail | undefined> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const rows = await db
    .select({
      deficiency: deficiencies,
      vessel: vessels,
    })
    .from(deficiencies)
    .innerJoin(vessels, eq(deficiencies.vesselId, vessels.id))
    .where(eq(deficiencies.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;

  const attachments = await db
    .select()
    .from(deficiencyAttachments)
    .where(eq(deficiencyAttachments.deficiencyId, id))
    .orderBy(desc(deficiencyAttachments.uploadedAt));

  return {
    ...row.deficiency,
    vesselName: row.vessel.name,
    attachments,
    vessel: row.vessel,
  };
}

/** @throws {DeficiencyNotFoundError} */
export async function requireDeficiencyById(
  ctx: AccessContext,
  id: string,
): Promise<DeficiencyDetail> {
  const row = await getDeficiencyById(ctx, id);
  if (!row) throw new DeficiencyNotFoundError(id);
  return row;
}

/** Creates a deficiency. */
export async function createDeficiency(
  ctx: AccessContext,
  input: DeficiencyCreateInput,
): Promise<DeficiencyRow> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  try {
    const inserted = await db
      .insert(deficiencies)
      .values({
        vesselId: input.vesselId,
        title: input.title,
        source: input.source,
        status: input.status,
        deficiencyNumber: input.deficiencyNumber ?? null,
        category: input.category ?? null,
        description: input.description ?? null,
        reference: input.reference ?? null,
        identifiedDate: input.identifiedDate ?? null,
        dueDate: input.dueDate ?? null,
        closedDate: input.closedDate ?? null,
        correctiveAction: input.correctiveAction ?? null,
        responsiblePerson: input.responsiblePerson ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("Insert did not return a row");
    return row;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new DeficiencyConflictError("Vessel reference is invalid.");
    }
    logError("DEFICIENCY_CREATE_FAILED", {
      error,
      vesselId: input.vesselId,
    });
    throw error;
  }
}

/** Partial update. Prefer dedicated transition helpers for status changes. */
export async function updateDeficiency(
  ctx: AccessContext,
  id: string,
  input: DeficiencyUpdateInput,
): Promise<DeficiencyRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const existing = await db
    .select()
    .from(deficiencies)
    .where(eq(deficiencies.id, id))
    .limit(1);
  if (!existing[0]) throw new DeficiencyNotFoundError(id);

  const patch: Partial<typeof deficiencies.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.title !== undefined) patch.title = input.title;
  if (input.source !== undefined) patch.source = input.source;
  if (input.status !== undefined) patch.status = input.status;
  if (input.deficiencyNumber !== undefined) {
    patch.deficiencyNumber = input.deficiencyNumber;
  }
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description;
  if (input.reference !== undefined) patch.reference = input.reference;
  if (input.identifiedDate !== undefined) {
    patch.identifiedDate = input.identifiedDate;
  }
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
  if (input.closedDate !== undefined) patch.closedDate = input.closedDate;
  if (input.correctiveAction !== undefined) {
    patch.correctiveAction = input.correctiveAction;
  }
  if (input.responsiblePerson !== undefined) {
    patch.responsiblePerson = input.responsiblePerson;
  }
  if (input.notes !== undefined) patch.notes = input.notes;

  try {
    const updated = await db
      .update(deficiencies)
      .set(patch)
      .where(eq(deficiencies.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new DeficiencyNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof DeficiencyNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new DeficiencyConflictError("Vessel reference is invalid.");
    }
    logError("DEFICIENCY_UPDATE_FAILED", { error, deficiencyId: id });
    throw error;
  }
}

async function setStatus(
  ctx: AccessContext,
  id: string,
  status: DeficiencyStatus,
  extras: Partial<typeof deficiencies.$inferInsert> = {},
): Promise<DeficiencyRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  try {
    const updated = await db
      .update(deficiencies)
      .set({
        status,
        updatedAt: new Date(),
        ...extras,
      })
      .where(eq(deficiencies.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new DeficiencyNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof DeficiencyNotFoundError) throw error;
    logError("DEFICIENCY_STATUS_FAILED", { error, deficiencyId: id, status });
    throw error;
  }
}

/** → `closed`; sets `closedDate` to today when not already set. */
export async function closeDeficiency(
  ctx: AccessContext,
  id: string,
): Promise<DeficiencyRow> {
  const existing = await getDeficiencyById(ctx, id);
  if (!existing) throw new DeficiencyNotFoundError(id);
  return setStatus(ctx, id, "closed", {
    closedDate: existing.closedDate ?? todayIso(),
  });
}

/** → `open`; clears `closedDate`. */
export async function reopenDeficiency(
  ctx: AccessContext,
  id: string,
): Promise<DeficiencyRow> {
  return setStatus(ctx, id, "open", { closedDate: null });
}

/** → `in_progress`. */
export async function startProgressDeficiency(
  ctx: AccessContext,
  id: string,
): Promise<DeficiencyRow> {
  return setStatus(ctx, id, "in_progress");
}

/** → `monitoring`. */
export async function setMonitoringDeficiency(
  ctx: AccessContext,
  id: string,
): Promise<DeficiencyRow> {
  return setStatus(ctx, id, "monitoring");
}

/** Hard-delete; attachments cascade + on-disk files removed. */
export async function deleteDeficiency(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  try {
    const atts = await db
      .select()
      .from(deficiencyAttachments)
      .where(eq(deficiencyAttachments.deficiencyId, id));
    for (const att of atts) {
      await removeStoredAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(deficiencies)
      .where(eq(deficiencies.id, id))
      .returning({ id: deficiencies.id });
    if (deleted.length === 0) throw new DeficiencyNotFoundError(id);
  } catch (error) {
    if (error instanceof DeficiencyNotFoundError) throw error;
    logError("DEFICIENCY_DELETE_FAILED", { error, deficiencyId: id });
    throw error;
  }
}

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

/** Multipart upload — max 10 MB; PDF/JPEG/PNG. */
export async function uploadDeficiencyAttachment(
  ctx: AccessContext,
  deficiencyId: string,
  file: { name: string; type: string; size: number; bytes: Buffer },
): Promise<DeficiencyAttachmentRow> {
  assertAuthenticatedAccess(ctx, deficiencyId);

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
  try {
    const parent = await db
      .select({ id: deficiencies.id })
      .from(deficiencies)
      .where(eq(deficiencies.id, deficiencyId))
      .limit(1);
    if (!parent[0]) throw new DeficiencyNotFoundError(deficiencyId);

    await mkdir(ATTACHMENTS_DIR, { recursive: true });
    const id = randomUUID();
    const storedName = `${id}${extensionForMime(file.type)}`;
    const absolute = path.join(ATTACHMENTS_DIR, storedName);
    const relativePath = path
      .join("data", "attachments", storedName)
      .replace(/\\/g, "/");
    await writeFile(absolute, file.bytes);

    const inserted = await db
      .insert(deficiencyAttachments)
      .values({
        id,
        deficiencyId,
        fileName: file.name.slice(0, 255) || storedName,
        filePath: relativePath,
        uploadedBy: ctx.userId,
      })
      .returning();
    const row = inserted[0];
    if (!row) {
      await removeStoredAttachmentFile(relativePath);
      throw new Error("Attachment insert did not return a row");
    }
    return row;
  } catch (error) {
    if (
      error instanceof DeficiencyNotFoundError ||
      error instanceof AttachmentValidationError
    ) {
      throw error;
    }
    logError("DEFICIENCY_ATTACHMENT_UPLOAD_FAILED", {
      error,
      deficiencyId,
    });
    throw error;
  }
}

export async function deleteDeficiencyAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(deficiencyAttachments)
      .where(eq(deficiencyAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AttachmentNotFoundError(attachmentId);
    await db
      .delete(deficiencyAttachments)
      .where(eq(deficiencyAttachments.id, attachmentId));
    await removeStoredAttachmentFile(row.filePath);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    logError("DEFICIENCY_ATTACHMENT_DELETE_FAILED", {
      error,
      attachmentId,
    });
    throw error;
  }
}

/** Lookup for the generic `/api/attachments/[id]` resolver. */
export async function getDeficiencyAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<DeficiencyAttachmentRow | undefined> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const rows = await getDb()
    .select()
    .from(deficiencyAttachments)
    .where(eq(deficiencyAttachments.id, attachmentId))
    .limit(1);
  return rows[0];
}

/**
 * Opens a read stream for a deficiency attachment (path from DB only).
 * Prefer the generic attachments route; this remains for module-local use.
 */
export async function openDeficiencyAttachmentStream(
  ctx: AccessContext,
  attachmentId: string,
): Promise<{ row: DeficiencyAttachmentRow; stream: NodeJS.ReadableStream }> {
  const row = await getDeficiencyAttachmentById(ctx, attachmentId);
  if (!row) throw new AttachmentNotFoundError(attachmentId);
  try {
    const { stream } = openStoredAttachmentStream(row.filePath);
    return { row, stream };
  } catch {
    throw new AttachmentNotFoundError(attachmentId);
  }
}
