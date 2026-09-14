/**
 * Drawings data-access layer (`PROJECT_PLAN.md` §11).
 *
 * Vessel-scoped technical drawings with standard attachments. Categories
 * are seed + read-only (Settings CRUD later). Not an expiry-engine
 * consumer — no cachedStatus / compliance derivation.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  drawingAttachments,
  drawingCategories,
  drawings,
  vessels,
  type DrawingAttachmentRow,
  type DrawingCategoryRow,
  type DrawingRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { removeStoredAttachmentFile } from "@/lib/attachments/stream";
import { logError } from "@/lib/logging";
import type { DrawingListItem } from "./drawing.model";
import type { DrawingCreateInput, DrawingUpdateInput } from "./validation";

export type { DrawingListItem } from "./drawing.model";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export class DrawingNotFoundError extends Error {
  readonly code = "DRAWING_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Drawing not found: ${id}`);
    this.name = "DrawingNotFoundError";
  }
}

export class DrawingConflictError extends Error {
  readonly code = "DRAWING_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "DrawingConflictError";
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

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

function toListItem(
  drawing: DrawingRow,
  vesselName: string,
  categoryName: string,
): DrawingListItem {
  return { ...drawing, vesselName, categoryName };
}

/** Read-only category list — create/update deferred to Settings. */
export async function listDrawingCategories(
  ctx: AccessContext,
): Promise<DrawingCategoryRow[]> {
  assertAuthenticatedAccess(ctx);
  return getDb()
    .select()
    .from(drawingCategories)
    .orderBy(asc(drawingCategories.name));
}

export type DrawingListFilters = {
  vesselId?: string;
  categoryId?: string;
};

export async function listDrawings(
  ctx: AccessContext,
  filters: DrawingListFilters = {},
): Promise<DrawingListItem[]> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.vesselId) {
    conditions.push(eq(drawings.vesselId, filters.vesselId));
  }
  if (filters.categoryId) {
    conditions.push(eq(drawings.categoryId, filters.categoryId));
  }

  const rows = await db
    .select({
      drawing: drawings,
      vesselName: vessels.name,
      categoryName: drawingCategories.name,
    })
    .from(drawings)
    .innerJoin(vessels, eq(drawings.vesselId, vessels.id))
    .innerJoin(
      drawingCategories,
      eq(drawings.categoryId, drawingCategories.id),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(vessels.name), asc(drawings.drawingName));

  return rows.map((r) =>
    toListItem(r.drawing, r.vesselName, r.categoryName),
  );
}

export type DrawingDetail = DrawingListItem & {
  attachments: DrawingAttachmentRow[];
};

export async function getDrawingById(
  ctx: AccessContext,
  id: string,
): Promise<DrawingDetail | undefined> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const rows = await db
    .select({
      drawing: drawings,
      vesselName: vessels.name,
      categoryName: drawingCategories.name,
    })
    .from(drawings)
    .innerJoin(vessels, eq(drawings.vesselId, vessels.id))
    .innerJoin(
      drawingCategories,
      eq(drawings.categoryId, drawingCategories.id),
    )
    .where(eq(drawings.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;

  const attachments = await db
    .select()
    .from(drawingAttachments)
    .where(eq(drawingAttachments.drawingId, id))
    .orderBy(asc(drawingAttachments.uploadedAt));

  return {
    ...toListItem(row.drawing, row.vesselName, row.categoryName),
    attachments,
  };
}

export async function createDrawing(
  ctx: AccessContext,
  input: DrawingCreateInput,
): Promise<DrawingRow> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  try {
    const inserted = await db
      .insert(drawings)
      .values({
        vesselId: input.vesselId,
        categoryId: input.categoryId,
        drawingName: input.drawingName,
        drawingNumber: input.drawingNumber ?? null,
        revision: input.revision ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("Drawing insert did not return a row");
    return row;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new DrawingConflictError(
        "Vessel or category reference is invalid.",
      );
    }
    logError("DRAWING_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateDrawing(
  ctx: AccessContext,
  id: string,
  input: DrawingUpdateInput,
): Promise<DrawingRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const existing = await db
    .select({ id: drawings.id })
    .from(drawings)
    .where(eq(drawings.id, id))
    .limit(1);
  if (!existing[0]) throw new DrawingNotFoundError(id);

  const patch: Partial<typeof drawings.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.drawingName !== undefined) patch.drawingName = input.drawingName;
  if (input.drawingNumber !== undefined) {
    patch.drawingNumber = input.drawingNumber;
  }
  if (input.revision !== undefined) patch.revision = input.revision;
  if (input.notes !== undefined) patch.notes = input.notes;

  try {
    const updated = await db
      .update(drawings)
      .set(patch)
      .where(eq(drawings.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new DrawingNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof DrawingNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new DrawingConflictError(
        "Vessel or category reference is invalid.",
      );
    }
    logError("DRAWING_UPDATE_FAILED", { error, drawingId: id });
    throw error;
  }
}

/** Hard-delete; removes on-disk attachment files first. */
export async function deleteDrawing(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  try {
    const atts = await db
      .select()
      .from(drawingAttachments)
      .where(eq(drawingAttachments.drawingId, id));
    for (const att of atts) {
      await removeStoredAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(drawings)
      .where(eq(drawings.id, id))
      .returning({ id: drawings.id });
    if (deleted.length === 0) throw new DrawingNotFoundError(id);
  } catch (error) {
    if (error instanceof DrawingNotFoundError) throw error;
    logError("DRAWING_DELETE_FAILED", { error, drawingId: id });
    throw error;
  }
}

export async function listDrawingAttachments(
  ctx: AccessContext,
  drawingId: string,
): Promise<DrawingAttachmentRow[]> {
  assertAuthenticatedAccess(ctx, drawingId);
  return getDb()
    .select()
    .from(drawingAttachments)
    .where(eq(drawingAttachments.drawingId, drawingId))
    .orderBy(asc(drawingAttachments.uploadedAt));
}

export async function uploadDrawingAttachment(
  ctx: AccessContext,
  drawingId: string,
  file: { name: string; type: string; size: number; bytes: Buffer },
): Promise<DrawingAttachmentRow> {
  assertAuthenticatedAccess(ctx, drawingId);

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
      .select({ id: drawings.id })
      .from(drawings)
      .where(eq(drawings.id, drawingId))
      .limit(1);
    if (!parent[0]) throw new DrawingNotFoundError(drawingId);

    await mkdir(ATTACHMENTS_DIR, { recursive: true });
    const id = randomUUID();
    const storedName = `${id}${extensionForMime(file.type)}`;
    const absolute = path.join(ATTACHMENTS_DIR, storedName);
    const relativePath = path
      .join("data", "attachments", storedName)
      .replace(/\\/g, "/");
    await writeFile(absolute, file.bytes);

    const inserted = await db
      .insert(drawingAttachments)
      .values({
        id,
        drawingId,
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
      error instanceof DrawingNotFoundError ||
      error instanceof AttachmentValidationError
    ) {
      throw error;
    }
    logError("DRAWING_ATTACHMENT_UPLOAD_FAILED", { error, drawingId });
    throw error;
  }
}

export async function deleteDrawingAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(drawingAttachments)
      .where(eq(drawingAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AttachmentNotFoundError(attachmentId);
    await db
      .delete(drawingAttachments)
      .where(eq(drawingAttachments.id, attachmentId));
    await removeStoredAttachmentFile(row.filePath);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    logError("DRAWING_ATTACHMENT_DELETE_FAILED", { error, attachmentId });
    throw error;
  }
}

/**
 * Lookup for the generic `/api/attachments/[id]` resolver.
 * Does not write access_logs — drawings are out of GDPR access-log scope
 * (SECURITY_PLAN.md §6b is Crew-only).
 */
export async function getDrawingAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<DrawingAttachmentRow | undefined> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const rows = await getDb()
    .select()
    .from(drawingAttachments)
    .where(eq(drawingAttachments.id, attachmentId))
    .limit(1);
  return rows[0];
}
