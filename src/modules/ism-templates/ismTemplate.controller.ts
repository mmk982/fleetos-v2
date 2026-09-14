/**
 * ISM Templates data-access layer (`PROJECT_PLAN.md` §9).
 *
 * Fleet-wide blank forms — no vesselId, no expiry engine / cachedStatus.
 * Only file in this module allowed to import drizzle-orm query builders.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  ismTemplateAttachments,
  ismTemplateCategories,
  ismTemplates,
  type IsmTemplateAttachmentRow,
  type IsmTemplateCategoryRow,
  type IsmTemplateRow,
  type IsmTemplateStatus,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import { removeStoredAttachmentFile } from "@/lib/attachments/stream";
import { logError } from "@/lib/logging";
import type { IsmTemplateListItem } from "./ismTemplate.model";
import type {
  IsmTemplateCreateInput,
  IsmTemplateUpdateInput,
} from "./validation";

export type { IsmTemplateListItem } from "./ismTemplate.model";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export class IsmTemplateNotFoundError extends Error {
  readonly code = "ISM_TEMPLATE_NOT_FOUND" as const;
  constructor(id: string) {
    super(`ISM template not found: ${id}`);
    this.name = "IsmTemplateNotFoundError";
  }
}

export class IsmTemplateConflictError extends Error {
  readonly code = "ISM_TEMPLATE_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "IsmTemplateConflictError";
  }
}

export class IsmTemplateCategoryNotFoundError extends Error {
  readonly code = "ISM_TEMPLATE_CATEGORY_NOT_FOUND" as const;
  constructor(id: string) {
    super(`ISM template category not found: ${id}`);
    this.name = "IsmTemplateCategoryNotFoundError";
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

function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

export type IsmTemplateListFilters = {
  categoryId?: string;
  status?: IsmTemplateStatus;
};

/** Category list for forms and Settings system lists. */
export async function listIsmTemplateCategories(
  ctx: AccessContext,
): Promise<IsmTemplateCategoryRow[]> {
  assertAuthenticatedAccess(ctx);
  return getDb()
    .select()
    .from(ismTemplateCategories)
    .orderBy(asc(ismTemplateCategories.name));
}

export async function createIsmTemplateCategory(
  ctx: AccessContext,
  input: { name: string },
): Promise<IsmTemplateCategoryRow> {
  assertAuthenticatedAccess(ctx);
  const name = input.name.trim();
  if (name.length === 0) {
    throw new IsmTemplateConflictError("Name is required.");
  }
  const db = getDb();
  try {
    const inserted = await db
      .insert(ismTemplateCategories)
      .values({ name, isCustom: true })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("ISM template category insert did not return a row");
    return row;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new IsmTemplateConflictError(
        "An ISM template category with that name already exists.",
      );
    }
    logError("ISM_TEMPLATE_CATEGORY_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateIsmTemplateCategory(
  ctx: AccessContext,
  id: string,
  input: { name: string },
): Promise<IsmTemplateCategoryRow> {
  assertAuthenticatedAccess(ctx, id);
  const name = input.name.trim();
  if (name.length === 0) {
    throw new IsmTemplateConflictError("Name is required.");
  }
  const db = getDb();
  const existing = await db
    .select({ id: ismTemplateCategories.id })
    .from(ismTemplateCategories)
    .where(eq(ismTemplateCategories.id, id))
    .limit(1);
  if (!existing[0]) throw new IsmTemplateCategoryNotFoundError(id);

  try {
    const updated = await db
      .update(ismTemplateCategories)
      .set({ name })
      .where(eq(ismTemplateCategories.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new IsmTemplateCategoryNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof IsmTemplateCategoryNotFoundError) throw error;
    if (isPgUniqueViolation(error)) {
      throw new IsmTemplateConflictError(
        "An ISM template category with that name already exists.",
      );
    }
    logError("ISM_TEMPLATE_CATEGORY_UPDATE_FAILED", {
      error,
      ismTemplateCategoryId: id,
    });
    throw error;
  }
}

export async function deleteIsmTemplateCategory(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  try {
    const deleted = await db
      .delete(ismTemplateCategories)
      .where(eq(ismTemplateCategories.id, id))
      .returning({ id: ismTemplateCategories.id });
    if (deleted.length === 0) throw new IsmTemplateCategoryNotFoundError(id);
  } catch (error) {
    if (error instanceof IsmTemplateCategoryNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new IsmTemplateConflictError(
        "Cannot delete: this ISM template category is still referenced by ISM templates.",
      );
    }
    logError("ISM_TEMPLATE_CATEGORY_DELETE_FAILED", {
      error,
      ismTemplateCategoryId: id,
    });
    throw error;
  }
}

export async function listIsmTemplates(
  ctx: AccessContext,
  filters: IsmTemplateListFilters = {},
): Promise<IsmTemplateListItem[]> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.categoryId) {
    conditions.push(eq(ismTemplates.categoryId, filters.categoryId));
  }
  if (filters.status) {
    conditions.push(eq(ismTemplates.status, filters.status));
  }

  const rows = await db
    .select({
      template: ismTemplates,
      categoryName: ismTemplateCategories.name,
    })
    .from(ismTemplates)
    .innerJoin(
      ismTemplateCategories,
      eq(ismTemplates.categoryId, ismTemplateCategories.id),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(ismTemplates.formCode));

  return rows.map((r) => ({
    ...r.template,
    categoryName: r.categoryName,
  }));
}

export type IsmTemplateDetail = IsmTemplateListItem & {
  attachments: IsmTemplateAttachmentRow[];
};

export async function getIsmTemplateById(
  ctx: AccessContext,
  id: string,
): Promise<IsmTemplateDetail | undefined> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const rows = await db
    .select({
      template: ismTemplates,
      categoryName: ismTemplateCategories.name,
    })
    .from(ismTemplates)
    .innerJoin(
      ismTemplateCategories,
      eq(ismTemplates.categoryId, ismTemplateCategories.id),
    )
    .where(eq(ismTemplates.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;

  const attachments = await db
    .select()
    .from(ismTemplateAttachments)
    .where(eq(ismTemplateAttachments.ismTemplateId, id))
    .orderBy(asc(ismTemplateAttachments.uploadedAt));

  return {
    ...row.template,
    categoryName: row.categoryName,
    attachments,
  };
}

export async function createIsmTemplate(
  ctx: AccessContext,
  input: IsmTemplateCreateInput,
): Promise<IsmTemplateRow> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  let row: IsmTemplateRow;
  try {
    const inserted = await db
      .insert(ismTemplates)
      .values({
        formCode: input.formCode,
        formName: input.formName,
        categoryId: input.categoryId,
        revision: input.revision ?? null,
        status: input.status,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) throw new Error("ISM template insert did not return a row");
    row = insertedRow;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new IsmTemplateConflictError(
        "A template with this form code already exists.",
      );
    }
    if (isPgForeignKeyViolation(error)) {
      throw new IsmTemplateConflictError("Category reference is invalid.");
    }
    logError("ISM_TEMPLATE_CREATE_FAILED", { error });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "ism_template",
    recordId: row.id,
    description: `Added ISM template: ${row.formName}`,
  });
  return row;
}

export async function updateIsmTemplate(
  ctx: AccessContext,
  id: string,
  input: IsmTemplateUpdateInput,
): Promise<IsmTemplateRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const existing = await db
    .select({ id: ismTemplates.id })
    .from(ismTemplates)
    .where(eq(ismTemplates.id, id))
    .limit(1);
  if (!existing[0]) throw new IsmTemplateNotFoundError(id);

  const patch: Partial<typeof ismTemplates.$inferInsert> & {
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (input.formCode !== undefined) patch.formCode = input.formCode;
  if (input.formName !== undefined) patch.formName = input.formName;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.revision !== undefined) patch.revision = input.revision;
  if (input.status !== undefined) patch.status = input.status;

  let row: IsmTemplateRow;
  try {
    const updated = await db
      .update(ismTemplates)
      .set(patch)
      .where(eq(ismTemplates.id, id))
      .returning();
    const updatedRow = updated[0];
    if (!updatedRow) throw new IsmTemplateNotFoundError(id);
    row = updatedRow;
  } catch (error) {
    if (error instanceof IsmTemplateNotFoundError) throw error;
    if (isPgUniqueViolation(error)) {
      throw new IsmTemplateConflictError(
        "A template with this form code already exists.",
      );
    }
    if (isPgForeignKeyViolation(error)) {
      throw new IsmTemplateConflictError("Category reference is invalid.");
    }
    logError("ISM_TEMPLATE_UPDATE_FAILED", { error, ismTemplateId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "ism_template",
    recordId: row.id,
    description: `Updated ISM template: ${row.formName}`,
  });
  return row;
}

/** Hard-delete; removes on-disk attachment files first. */
export async function deleteIsmTemplate(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const existing = await db
    .select({ formName: ismTemplates.formName })
    .from(ismTemplates)
    .where(eq(ismTemplates.id, id))
    .limit(1);
  const formName = existing[0]?.formName;
  try {
    const atts = await db
      .select()
      .from(ismTemplateAttachments)
      .where(eq(ismTemplateAttachments.ismTemplateId, id));
    for (const att of atts) {
      await removeStoredAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(ismTemplates)
      .where(eq(ismTemplates.id, id))
      .returning({ id: ismTemplates.id });
    if (deleted.length === 0) throw new IsmTemplateNotFoundError(id);
  } catch (error) {
    if (error instanceof IsmTemplateNotFoundError) throw error;
    logError("ISM_TEMPLATE_DELETE_FAILED", { error, ismTemplateId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "ism_template",
    recordId: id,
    description: formName
      ? `Deleted ISM template: ${formName}`
      : "Deleted ISM template",
  });
}

export async function listIsmTemplateAttachments(
  ctx: AccessContext,
  ismTemplateId: string,
): Promise<IsmTemplateAttachmentRow[]> {
  assertAuthenticatedAccess(ctx, ismTemplateId);
  return getDb()
    .select()
    .from(ismTemplateAttachments)
    .where(eq(ismTemplateAttachments.ismTemplateId, ismTemplateId))
    .orderBy(asc(ismTemplateAttachments.uploadedAt));
}

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

export async function uploadIsmTemplateAttachment(
  ctx: AccessContext,
  ismTemplateId: string,
  file: { name: string; type: string; size: number; bytes: Buffer },
): Promise<IsmTemplateAttachmentRow> {
  assertAuthenticatedAccess(ctx, ismTemplateId);

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
  let row: IsmTemplateAttachmentRow;
  try {
    const parent = await db
      .select({ id: ismTemplates.id })
      .from(ismTemplates)
      .where(eq(ismTemplates.id, ismTemplateId))
      .limit(1);
    if (!parent[0]) throw new IsmTemplateNotFoundError(ismTemplateId);

    await mkdir(ATTACHMENTS_DIR, { recursive: true });
    const id = randomUUID();
    const storedName = `${id}${extensionForMime(file.type)}`;
    const absolute = path.join(ATTACHMENTS_DIR, storedName);
    const relativePath = path
      .join("data", "attachments", storedName)
      .replace(/\\/g, "/");
    await writeFile(absolute, file.bytes);

    const inserted = await db
      .insert(ismTemplateAttachments)
      .values({
        id,
        ismTemplateId,
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
      error instanceof IsmTemplateNotFoundError ||
      error instanceof AttachmentValidationError
    ) {
      throw error;
    }
    logError("ISM_TEMPLATE_ATTACHMENT_UPLOAD_FAILED", {
      error,
      ismTemplateId,
    });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "uploaded",
    moduleName: "ism_template",
    recordId: ismTemplateId,
    description: `Uploaded attachment to ISM template: ${row.fileName}`,
  });
  return row;
}

export async function deleteIsmTemplateAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(ismTemplateAttachments)
      .where(eq(ismTemplateAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AttachmentNotFoundError(attachmentId);
    await db
      .delete(ismTemplateAttachments)
      .where(eq(ismTemplateAttachments.id, attachmentId));
    await removeStoredAttachmentFile(row.filePath);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    logError("ISM_TEMPLATE_ATTACHMENT_DELETE_FAILED", {
      error,
      attachmentId,
    });
    throw error;
  }
}

/**
 * Lookup for the generic `/api/attachments/[id]` resolver.
 * Does not write access_logs — ISM templates are out of GDPR access-log
 * scope (SECURITY_PLAN.md §6b is Crew-only).
 */
export async function getIsmTemplateAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<IsmTemplateAttachmentRow | undefined> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const rows = await getDb()
    .select()
    .from(ismTemplateAttachments)
    .where(eq(ismTemplateAttachments.id, attachmentId))
    .limit(1);
  return rows[0];
}
