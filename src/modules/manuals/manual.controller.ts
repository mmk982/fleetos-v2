/**
 * Manuals data-access layer (`PROJECT_PLAN.md` §8).
 *
 * Vessel-linked manuals with revision history. New revisions and
 * set-current flips run in `db.transaction()` so exactly one
 * `isCurrentVersion = true` row exists per manual after commit.
 * Not an expiry-engine consumer.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  manuals,
  manualRevisions,
  vessels,
  type ManualRevisionRow,
  type ManualRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { removeStoredAttachmentFile } from "@/lib/attachments/stream";
import { logError } from "@/lib/logging";
import type { ManualDetail, ManualListItem } from "./manual.model";
import type {
  ManualCreateInput,
  ManualRevisionCreateInput,
  ManualUpdateInput,
} from "./validation";

export type { ManualDetail, ManualListItem } from "./manual.model";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export class ManualNotFoundError extends Error {
  readonly code = "MANUAL_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Manual not found: ${id}`);
    this.name = "ManualNotFoundError";
  }
}

export class ManualRevisionNotFoundError extends Error {
  readonly code = "MANUAL_REVISION_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Manual revision not found: ${id}`);
    this.name = "ManualRevisionNotFoundError";
  }
}

export class ManualConflictError extends Error {
  readonly code = "MANUAL_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "ManualConflictError";
  }
}

export class AttachmentValidationError extends Error {
  readonly code = "ATTACHMENT_VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "AttachmentValidationError";
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

type UploadFile = {
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
};

function assertValidAttachment(file: UploadFile): void {
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
}

async function storeAttachmentFile(
  file: UploadFile,
): Promise<{ id: string; relativePath: string; fileName: string }> {
  await mkdir(ATTACHMENTS_DIR, { recursive: true });
  const id = randomUUID();
  const storedName = `${id}${extensionForMime(file.type)}`;
  const absolute = path.join(ATTACHMENTS_DIR, storedName);
  const relativePath = path
    .join("data", "attachments", storedName)
    .replace(/\\/g, "/");
  await writeFile(absolute, file.bytes);
  return {
    id,
    relativePath,
    fileName: file.name.slice(0, 255) || storedName,
  };
}

export type ManualListFilters = {
  vesselId?: string;
  manualType?: string;
  department?: string;
};

export async function listManuals(
  ctx: AccessContext,
  filters: ManualListFilters = {},
): Promise<ManualListItem[]> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.vesselId) {
    conditions.push(eq(manuals.vesselId, filters.vesselId));
  }
  if (filters.manualType) {
    conditions.push(eq(manuals.manualType, filters.manualType));
  }
  if (filters.department) {
    conditions.push(eq(manuals.department, filters.department));
  }

  const rows = await db
    .select({
      manual: manuals,
      vesselName: vessels.name,
    })
    .from(manuals)
    .innerJoin(vessels, eq(manuals.vesselId, vessels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(vessels.name), asc(manuals.title));

  const result: ManualListItem[] = [];
  for (const r of rows) {
    const [currentRows, countRows] = await Promise.all([
      db
        .select()
        .from(manualRevisions)
        .where(
          and(
            eq(manualRevisions.manualId, r.manual.id),
            eq(manualRevisions.isCurrentVersion, true),
          ),
        )
        .limit(1),
      db
        .select({ n: count() })
        .from(manualRevisions)
        .where(eq(manualRevisions.manualId, r.manual.id)),
    ]);
    result.push({
      ...r.manual,
      vesselName: r.vesselName,
      currentRevision: currentRows[0] ?? null,
      revisionCount: Number(countRows[0]?.n ?? 0),
    });
  }
  return result;
}

export async function getManualById(
  ctx: AccessContext,
  id: string,
): Promise<ManualDetail | undefined> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const rows = await db
    .select({
      manual: manuals,
      vesselName: vessels.name,
    })
    .from(manuals)
    .innerJoin(vessels, eq(manuals.vesselId, vessels.id))
    .where(eq(manuals.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;

  const revisions = await db
    .select()
    .from(manualRevisions)
    .where(eq(manualRevisions.manualId, id))
    .orderBy(desc(manualRevisions.uploadedAt));

  const currentRevision =
    revisions.find((r) => r.isCurrentVersion) ?? null;

  return {
    ...row.manual,
    vesselName: row.vesselName,
    currentRevision,
    revisionCount: revisions.length,
    revisions,
  };
}

/**
 * Creates a manuals row + first revision in one transaction.
 * File is written to disk first; removed if the transaction fails.
 */
export async function createManualWithFirstRevision(
  ctx: AccessContext,
  input: ManualCreateInput,
  file: UploadFile,
  firstRevision: {
    revisionNumber?: string | null;
    revisionDate?: string | null;
  } = {},
): Promise<ManualRow> {
  assertAuthenticatedAccess(ctx);
  assertValidAttachment(file);

  const stored = await storeAttachmentFile(file);
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(manuals)
        .values({
          vesselId: input.vesselId,
          title: input.title,
          manualType: input.manualType ?? null,
          department: input.department ?? null,
          notes: input.notes ?? null,
        })
        .returning();
      const manual = inserted[0];
      if (!manual) throw new Error("Manual insert did not return a row");

      await tx.insert(manualRevisions).values({
        id: stored.id,
        manualId: manual.id,
        revisionNumber: firstRevision.revisionNumber ?? null,
        revisionDate: firstRevision.revisionDate ?? null,
        fileName: stored.fileName,
        filePath: stored.relativePath,
        uploadedBy: ctx.userId,
        isCurrentVersion: true,
      });

      return manual;
    });
  } catch (error) {
    await removeStoredAttachmentFile(stored.relativePath);
    if (isPgForeignKeyViolation(error)) {
      throw new ManualConflictError("Vessel reference is invalid.");
    }
    logError("MANUAL_CREATE_FAILED", { error });
    throw error;
  }
}

/**
 * Adds a revision and makes it current — flips all other revisions for
 * this manual to `isCurrentVersion = false` in the same transaction.
 */
export async function addManualRevision(
  ctx: AccessContext,
  manualId: string,
  input: Omit<ManualRevisionCreateInput, "manualId">,
  file: UploadFile,
): Promise<ManualRevisionRow> {
  assertAuthenticatedAccess(ctx, manualId);
  assertValidAttachment(file);

  const db = getDb();
  const parent = await db
    .select({ id: manuals.id })
    .from(manuals)
    .where(eq(manuals.id, manualId))
    .limit(1);
  if (!parent[0]) throw new ManualNotFoundError(manualId);

  const stored = await storeAttachmentFile(file);

  try {
    return await db.transaction(async (tx) => {
      await tx
        .update(manualRevisions)
        .set({ isCurrentVersion: false })
        .where(eq(manualRevisions.manualId, manualId));

      const inserted = await tx
        .insert(manualRevisions)
        .values({
          id: stored.id,
          manualId,
          revisionNumber: input.revisionNumber ?? null,
          revisionDate: input.revisionDate ?? null,
          fileName: stored.fileName,
          filePath: stored.relativePath,
          uploadedBy: ctx.userId,
          isCurrentVersion: true,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("Revision insert did not return a row");

      await tx
        .update(manuals)
        .set({ updatedAt: new Date() })
        .where(eq(manuals.id, manualId));

      return row;
    });
  } catch (error) {
    await removeStoredAttachmentFile(stored.relativePath);
    if (error instanceof ManualNotFoundError) throw error;
    logError("MANUAL_REVISION_ADD_FAILED", { error, manualId });
    throw error;
  }
}

export async function updateManual(
  ctx: AccessContext,
  id: string,
  input: ManualUpdateInput,
): Promise<ManualRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const existing = await db
    .select({ id: manuals.id })
    .from(manuals)
    .where(eq(manuals.id, id))
    .limit(1);
  if (!existing[0]) throw new ManualNotFoundError(id);

  const patch: Partial<typeof manuals.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.title !== undefined) patch.title = input.title;
  if (input.manualType !== undefined) patch.manualType = input.manualType;
  if (input.department !== undefined) patch.department = input.department;
  if (input.notes !== undefined) patch.notes = input.notes;

  try {
    const updated = await db
      .update(manuals)
      .set(patch)
      .where(eq(manuals.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new ManualNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof ManualNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new ManualConflictError("Vessel reference is invalid.");
    }
    logError("MANUAL_UPDATE_FAILED", { error, manualId: id });
    throw error;
  }
}

/**
 * Re-marks an older revision as current (§8). Transaction: all false,
 * then chosen revision true.
 */
export async function setCurrentRevision(
  ctx: AccessContext,
  manualId: string,
  revisionId: string,
): Promise<ManualRevisionRow> {
  assertAuthenticatedAccess(ctx, manualId);
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const target = await tx
        .select()
        .from(manualRevisions)
        .where(
          and(
            eq(manualRevisions.id, revisionId),
            eq(manualRevisions.manualId, manualId),
          ),
        )
        .limit(1);
      if (!target[0]) throw new ManualRevisionNotFoundError(revisionId);

      await tx
        .update(manualRevisions)
        .set({ isCurrentVersion: false })
        .where(eq(manualRevisions.manualId, manualId));

      const updated = await tx
        .update(manualRevisions)
        .set({ isCurrentVersion: true })
        .where(eq(manualRevisions.id, revisionId))
        .returning();
      const row = updated[0];
      if (!row) throw new ManualRevisionNotFoundError(revisionId);

      await tx
        .update(manuals)
        .set({ updatedAt: new Date() })
        .where(eq(manuals.id, manualId));

      return row;
    });
  } catch (error) {
    if (error instanceof ManualRevisionNotFoundError) throw error;
    logError("MANUAL_SET_CURRENT_FAILED", {
      error,
      manualId,
      revisionId,
    });
    throw error;
  }
}

export async function deleteManual(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  try {
    const atts = await db
      .select()
      .from(manualRevisions)
      .where(eq(manualRevisions.manualId, id));
    for (const att of atts) {
      await removeStoredAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(manuals)
      .where(eq(manuals.id, id))
      .returning({ id: manuals.id });
    if (deleted.length === 0) throw new ManualNotFoundError(id);
  } catch (error) {
    if (error instanceof ManualNotFoundError) throw error;
    logError("MANUAL_DELETE_FAILED", { error, manualId: id });
    throw error;
  }
}

/**
 * Lookup for the generic `/api/attachments/[id]` resolver.
 * Does not write access_logs — manuals are out of GDPR access-log scope
 * (SECURITY_PLAN.md §6b is Crew-only).
 */
export async function getManualRevisionAttachmentById(
  ctx: AccessContext,
  revisionId: string,
): Promise<
  | Pick<ManualRevisionRow, "fileName" | "filePath" | "uploadedBy">
  | undefined
> {
  assertAuthenticatedAccess(ctx, revisionId);
  const rows = await getDb()
    .select({
      fileName: manualRevisions.fileName,
      filePath: manualRevisions.filePath,
      uploadedBy: manualRevisions.uploadedBy,
    })
    .from(manualRevisions)
    .where(eq(manualRevisions.id, revisionId))
    .limit(1);
  return rows[0];
}
