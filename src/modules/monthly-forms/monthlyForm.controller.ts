/**
 * Monthly Executed Forms data-access (`PROJECT_PLAN.md` §10).
 *
 * Checklist generation, ad-hoc create, submit (status mutation + attachment),
 * and attachment CRUD. Display "overdue" is derived, never stored.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  ismTemplates,
  monthlyExecutedFormAttachments,
  monthlyExecutedForms,
  monthlyFormRequirements,
  vessels,
  type MonthlyExecutedFormAttachmentRow,
  type MonthlyExecutedFormRow,
  type MonthlyFormFrequency,
  type MonthlyFormStatus,
  type UserRole,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertVesselScope,
  ForbiddenError,
  type AccessContext,
} from "@/lib/auth/access";
import { getMonthlyFormAccess } from "@/lib/auth/permissions";
import { removeStoredAttachmentFile } from "@/lib/attachments/stream";
import { writeActivityLog } from "@/lib/activity-log/write";
import { logError } from "@/lib/logging";
import { deriveMonthlyFormDisplayStatus } from "./monthly-form-status";
import type { MonthlyFormListItem } from "./monthlyForm.model";
import type {
  MonthlyFormCreateInput,
  MonthlyFormSubmitInput,
} from "./validation";

export type { MonthlyFormListItem } from "./monthlyForm.model";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export class MonthlyFormNotFoundError extends Error {
  readonly code = "MONTHLY_FORM_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Monthly executed form not found: ${id}`);
    this.name = "MonthlyFormNotFoundError";
  }
}

export class MonthlyFormConflictError extends Error {
  readonly code = "MONTHLY_FORM_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "MonthlyFormConflictError";
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

/** Whether a requirement is due in the given calendar month. */
export function isRequirementDueInMonth(
  frequency: MonthlyFormFrequency,
  month: number,
): boolean {
  if (frequency === "monthly") return true;
  if (frequency === "quarterly") {
    return month === 1 || month === 4 || month === 7 || month === 10;
  }
  if (frequency === "yearly") return month === 1;
  // on_demand — never auto-generated
  return false;
}

export type MonthlyFormListFilters = {
  vesselId?: string;
  month?: number;
  year?: number;
  status?: MonthlyFormStatus;
};

export async function listMonthlyForms(
  ctx: AccessContext,
  filters: MonthlyFormListFilters = {},
): Promise<MonthlyFormListItem[]> {
  assertAuthenticatedAccess(ctx);
  const access = getMonthlyFormAccess(ctx.role as UserRole | null);
  if (access === "none") {
    throw new ForbiddenError("Insufficient access for monthly forms.");
  }
  const db = getDb();
  const conditions: SQL[] = [];
  if (access === "submit") {
    if (!ctx.vesselId) return [];
    conditions.push(eq(monthlyExecutedForms.vesselId, ctx.vesselId));
  } else if (filters.vesselId) {
    conditions.push(eq(monthlyExecutedForms.vesselId, filters.vesselId));
  }
  if (filters.month !== undefined) {
    conditions.push(eq(monthlyExecutedForms.month, filters.month));
  }
  if (filters.year !== undefined) {
    conditions.push(eq(monthlyExecutedForms.year, filters.year));
  }
  if (filters.status) {
    conditions.push(eq(monthlyExecutedForms.status, filters.status));
  }

  const rows = await db
    .select({
      form: monthlyExecutedForms,
      vesselName: vessels.name,
    })
    .from(monthlyExecutedForms)
    .innerJoin(vessels, eq(monthlyExecutedForms.vesselId, vessels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      desc(monthlyExecutedForms.year),
      desc(monthlyExecutedForms.month),
      asc(vessels.name),
      asc(monthlyExecutedForms.formName),
    );

  const result: MonthlyFormListItem[] = [];
  for (const r of rows) {
    const countRows = await db
      .select({ n: count() })
      .from(monthlyExecutedFormAttachments)
      .where(eq(monthlyExecutedFormAttachments.executedFormId, r.form.id));
    result.push({
      ...r.form,
      vesselName: r.vesselName,
      displayStatus: deriveMonthlyFormDisplayStatus(
        r.form.status,
        r.form.month,
        r.form.year,
      ),
      attachmentCount: Number(countRows[0]?.n ?? 0),
    });
  }
  return result;
}

export type MonthlyFormDetail = MonthlyFormListItem & {
  attachments: MonthlyExecutedFormAttachmentRow[];
};

export async function getMonthlyFormById(
  ctx: AccessContext,
  id: string,
): Promise<MonthlyFormDetail | undefined> {
  assertAuthenticatedAccess(ctx, id);
  const access = getMonthlyFormAccess(ctx.role as UserRole | null);
  if (access === "none") {
    throw new ForbiddenError("Insufficient access for monthly forms.");
  }
  const db = getDb();
  const rows = await db
    .select({
      form: monthlyExecutedForms,
      vesselName: vessels.name,
    })
    .from(monthlyExecutedForms)
    .innerJoin(vessels, eq(monthlyExecutedForms.vesselId, vessels.id))
    .where(eq(monthlyExecutedForms.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  assertVesselScope(ctx, row.form.vesselId);

  const attachments = await db
    .select()
    .from(monthlyExecutedFormAttachments)
    .where(eq(monthlyExecutedFormAttachments.executedFormId, id))
    .orderBy(asc(monthlyExecutedFormAttachments.uploadedAt));

  return {
    ...row.form,
    vesselName: row.vesselName,
    displayStatus: deriveMonthlyFormDisplayStatus(
      row.form.status,
      row.form.month,
      row.form.year,
    ),
    attachmentCount: attachments.length,
    attachments,
  };
}

export async function createMonthlyForm(
  ctx: AccessContext,
  input: MonthlyFormCreateInput,
): Promise<MonthlyExecutedFormRow> {
  assertAuthenticatedAccess(ctx);
  const access = getMonthlyFormAccess(ctx.role as UserRole | null);
  if (access !== "full") {
    throw new ForbiddenError(
      "Insufficient access for monthly forms (need full).",
    );
  }
  assertVesselScope(ctx, input.vesselId);
  const db = getDb();

  let formName = input.formName?.trim() || "";
  if (input.ismTemplateId) {
    const templates = await db
      .select({ formName: ismTemplates.formName })
      .from(ismTemplates)
      .where(eq(ismTemplates.id, input.ismTemplateId))
      .limit(1);
    if (!templates[0]) {
      throw new MonthlyFormConflictError("ISM template reference is invalid.");
    }
    if (!formName) formName = templates[0].formName;
  }
  if (!formName) {
    throw new MonthlyFormConflictError("Form name is required.");
  }

  let row: MonthlyExecutedFormRow;
  try {
    const inserted = await db
      .insert(monthlyExecutedForms)
      .values({
        vesselId: input.vesselId,
        ismTemplateId: input.ismTemplateId ?? null,
        formName,
        month: input.month,
        year: input.year,
        required: false,
        status: "pending",
        remarks: input.remarks ?? null,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) throw new Error("Monthly form insert did not return a row");
    row = insertedRow;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new MonthlyFormConflictError(
        "A form for this vessel/template/period already exists.",
      );
    }
    if (isPgForeignKeyViolation(error)) {
      throw new MonthlyFormConflictError(
        "Vessel or ISM template reference is invalid.",
      );
    }
    logError("MONTHLY_FORM_CREATE_FAILED", { error });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "monthly_form",
    recordId: row.id,
    description: `Added monthly form: ${row.formName} (${row.month}/${row.year})`,
  });
  return row;
}

/**
 * Inserts pending executed-form rows for active requirements due in the
 * target period. Idempotent via onConflictDoNothing on the unique period key.
 */
export async function generateMonthlyChecklist(
  ctx: AccessContext,
  options: { vesselId?: string; month?: number; year?: number } = {},
): Promise<{ created: number }> {
  assertAuthenticatedAccess(ctx);
  const access = getMonthlyFormAccess(ctx.role as UserRole | null);
  if (access !== "full") {
    throw new ForbiddenError(
      "Insufficient access for monthly forms (need full).",
    );
  }
  if (options.vesselId) {
    assertVesselScope(ctx, options.vesselId);
  }
  const now = new Date();
  const month = options.month ?? now.getMonth() + 1;
  const year = options.year ?? now.getFullYear();
  const db = getDb();

  const conditions: SQL[] = [
    eq(monthlyFormRequirements.activeStatus, true),
  ];
  if (options.vesselId) {
    conditions.push(eq(monthlyFormRequirements.vesselId, options.vesselId));
  }

  const requirements = await db
    .select({
      requirement: monthlyFormRequirements,
      templateName: ismTemplates.formName,
    })
    .from(monthlyFormRequirements)
    .innerJoin(
      ismTemplates,
      eq(monthlyFormRequirements.ismTemplateId, ismTemplates.id),
    )
    .where(and(...conditions));

  let created = 0;
  for (const r of requirements) {
    if (!isRequirementDueInMonth(r.requirement.frequency, month)) {
      continue;
    }

    const inserted = await db
      .insert(monthlyExecutedForms)
      .values({
        vesselId: r.requirement.vesselId,
        ismTemplateId: r.requirement.ismTemplateId,
        formName: r.templateName,
        month,
        year,
        required: true,
        status: "pending",
      })
      .onConflictDoNothing({
        target: [
          monthlyExecutedForms.vesselId,
          monthlyExecutedForms.ismTemplateId,
          monthlyExecutedForms.month,
          monthlyExecutedForms.year,
        ],
      })
      .returning({ id: monthlyExecutedForms.id });

    created += inserted.length;
  }

  return { created };
}

/**
 * First submission: sets status/uploadedAt/uploadedBy + attachment in one
 * transaction. Re-upload: attachment only.
 */
export async function submitMonthlyForm(
  ctx: AccessContext,
  id: string,
  input: MonthlyFormSubmitInput,
  file: UploadFile,
): Promise<MonthlyExecutedFormRow> {
  assertAuthenticatedAccess(ctx, id);
  const access = getMonthlyFormAccess(ctx.role as UserRole | null);
  if (access !== "submit" && access !== "full") {
    throw new ForbiddenError(
      "Insufficient access for monthly forms (need submit).",
    );
  }
  assertValidAttachment(file);

  const db = getDb();
  const existing = await db
    .select()
    .from(monthlyExecutedForms)
    .where(eq(monthlyExecutedForms.id, id))
    .limit(1);
  const form = existing[0];
  if (!form) throw new MonthlyFormNotFoundError(id);
  assertVesselScope(ctx, form.vesselId);

  const stored = await storeAttachmentFile(file);
  const isFirstSubmission =
    form.status === "pending" && form.uploadedAt === null;

  let row: MonthlyExecutedFormRow;
  try {
    row = await db.transaction(async (tx) => {
      await tx.insert(monthlyExecutedFormAttachments).values({
        id: stored.id,
        executedFormId: id,
        fileName: stored.fileName,
        filePath: stored.relativePath,
        uploadedBy: ctx.userId,
      });

      if (isFirstSubmission) {
        const updated = await tx
          .update(monthlyExecutedForms)
          .set({
            status: "submitted",
            uploadedAt: new Date(),
            uploadedBy: ctx.userId,
            remarks:
              input.remarks !== undefined ? input.remarks : form.remarks,
            updatedAt: new Date(),
          })
          .where(eq(monthlyExecutedForms.id, id))
          .returning();
        const updatedRow = updated[0];
        if (!updatedRow) throw new MonthlyFormNotFoundError(id);
        return updatedRow;
      }

      const touched = await tx
        .update(monthlyExecutedForms)
        .set({ updatedAt: new Date() })
        .where(eq(monthlyExecutedForms.id, id))
        .returning();
      return touched[0] ?? form;
    });
  } catch (error) {
    await removeStoredAttachmentFile(stored.relativePath);
    if (error instanceof MonthlyFormNotFoundError) throw error;
    logError("MONTHLY_FORM_SUBMIT_FAILED", { error, executedFormId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "submitted",
    moduleName: "monthly_form",
    recordId: row.id,
    description: `Submitted monthly form: ${row.formName} (${row.month}/${row.year})`,
  });
  return row;
}

export async function deleteMonthlyForm(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const access = getMonthlyFormAccess(ctx.role as UserRole | null);
  if (access !== "full") {
    throw new ForbiddenError(
      "Insufficient access for monthly forms (need full).",
    );
  }
  const db = getDb();
  const existing = await db
    .select({
      formName: monthlyExecutedForms.formName,
      month: monthlyExecutedForms.month,
      year: monthlyExecutedForms.year,
      vesselId: monthlyExecutedForms.vesselId,
    })
    .from(monthlyExecutedForms)
    .where(eq(monthlyExecutedForms.id, id))
    .limit(1);
  const formMeta = existing[0];
  if (!formMeta) throw new MonthlyFormNotFoundError(id);
  assertVesselScope(ctx, formMeta.vesselId);
  try {
    const atts = await db
      .select()
      .from(monthlyExecutedFormAttachments)
      .where(eq(monthlyExecutedFormAttachments.executedFormId, id));
    for (const att of atts) {
      await removeStoredAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(monthlyExecutedForms)
      .where(eq(monthlyExecutedForms.id, id))
      .returning({ id: monthlyExecutedForms.id });
    if (deleted.length === 0) throw new MonthlyFormNotFoundError(id);
  } catch (error) {
    if (error instanceof MonthlyFormNotFoundError) throw error;
    logError("MONTHLY_FORM_DELETE_FAILED", { error, executedFormId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "monthly_form",
    recordId: id,
    description: `Deleted monthly form: ${formMeta.formName} (${formMeta.month}/${formMeta.year})`,
  });
}

export async function listMonthlyFormAttachments(
  ctx: AccessContext,
  executedFormId: string,
): Promise<MonthlyExecutedFormAttachmentRow[]> {
  assertAuthenticatedAccess(ctx, executedFormId);
  const access = getMonthlyFormAccess(ctx.role as UserRole | null);
  if (access === "none") {
    throw new ForbiddenError("Insufficient access for monthly forms.");
  }
  const db = getDb();
  const parent = await db
    .select({ vesselId: monthlyExecutedForms.vesselId })
    .from(monthlyExecutedForms)
    .where(eq(monthlyExecutedForms.id, executedFormId))
    .limit(1);
  if (!parent[0]) return [];
  assertVesselScope(ctx, parent[0].vesselId);
  return db
    .select()
    .from(monthlyExecutedFormAttachments)
    .where(eq(monthlyExecutedFormAttachments.executedFormId, executedFormId))
    .orderBy(asc(monthlyExecutedFormAttachments.uploadedAt));
}

export async function deleteMonthlyFormAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const access = getMonthlyFormAccess(ctx.role as UserRole | null);
  if (access !== "full") {
    throw new ForbiddenError(
      "Insufficient access for monthly forms (need full).",
    );
  }
  const db = getDb();
  try {
    const rows = await db
      .select({
        attachment: monthlyExecutedFormAttachments,
        vesselId: monthlyExecutedForms.vesselId,
      })
      .from(monthlyExecutedFormAttachments)
      .innerJoin(
        monthlyExecutedForms,
        eq(
          monthlyExecutedFormAttachments.executedFormId,
          monthlyExecutedForms.id,
        ),
      )
      .where(eq(monthlyExecutedFormAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AttachmentNotFoundError(attachmentId);
    assertVesselScope(ctx, row.vesselId);
    await db
      .delete(monthlyExecutedFormAttachments)
      .where(eq(monthlyExecutedFormAttachments.id, attachmentId));
    await removeStoredAttachmentFile(row.attachment.filePath);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    if (error instanceof ForbiddenError) throw error;
    logError("MONTHLY_FORM_ATTACHMENT_DELETE_FAILED", {
      error,
      attachmentId,
    });
    throw error;
  }
}

/**
 * Lookup for the generic `/api/attachments/[id]` resolver.
 * Does not write access_logs — monthly forms are out of GDPR access-log
 * scope (SECURITY_PLAN.md §6b is Crew-only).
 */
export async function getMonthlyFormAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<MonthlyExecutedFormAttachmentRow | undefined> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const access = getMonthlyFormAccess(ctx.role as UserRole | null);
  if (access === "none") {
    throw new ForbiddenError("Insufficient access for monthly forms.");
  }
  const rows = await getDb()
    .select({
      attachment: monthlyExecutedFormAttachments,
      vesselId: monthlyExecutedForms.vesselId,
    })
    .from(monthlyExecutedFormAttachments)
    .innerJoin(
      monthlyExecutedForms,
      eq(
        monthlyExecutedFormAttachments.executedFormId,
        monthlyExecutedForms.id,
      ),
    )
    .where(eq(monthlyExecutedFormAttachments.id, attachmentId))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  assertVesselScope(ctx, row.vesselId);
  return row.attachment;
}
