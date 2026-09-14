/**
 * Ship Particulars data-access (`PROJECT_PLAN.md` §13).
 *
 * Exactly one `isCurrent = true` row per vessel — enforced in
 * `db.transaction()` the same way as `manual_revisions.isCurrentVersion`.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  vesselParticulars,
  vesselParticularsAttachments,
  vessels,
  type VesselParticularsAttachmentRow,
  type VesselParticularsRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { removeStoredAttachmentFile } from "@/lib/attachments/stream";
import { writeActivityLog } from "@/lib/activity-log/write";
import { logError } from "@/lib/logging";
import type {
  ParticularsCurrentDetail,
  ParticularsSummaryItem,
  ParticularsVesselDetail,
} from "./particulars.model";
import type {
  ParticularsCreateInput,
  ParticularsUpdateInput,
} from "./validation";

export type {
  ParticularsCurrentDetail,
  ParticularsSummaryItem,
  ParticularsVesselDetail,
} from "./particulars.model";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export class ParticularsNotFoundError extends Error {
  readonly code = "PARTICULARS_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Vessel particulars not found: ${id}`);
    this.name = "ParticularsNotFoundError";
  }
}

export class ParticularsConflictError extends Error {
  readonly code = "PARTICULARS_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "ParticularsConflictError";
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

/** Postgres `numeric` columns accept string; coerce JS numbers for insert. */
function numToDb(
  value: number | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value);
}

function valuesFromInput(
  input: ParticularsCreateInput | ParticularsUpdateInput,
): Partial<typeof vesselParticulars.$inferInsert> {
  const patch: Partial<typeof vesselParticulars.$inferInsert> = {};
  if ("vesselId" in input && input.vesselId !== undefined) {
    patch.vesselId = input.vesselId;
  }
  if (input.classSociety !== undefined) patch.classSociety = input.classSociety;
  if (input.portOfRegistry !== undefined) {
    patch.portOfRegistry = input.portOfRegistry;
  }
  if (input.owner !== undefined) patch.owner = input.owner;
  if (input.manager !== undefined) patch.manager = input.manager;
  if (input.deadweightTonnage !== undefined) {
    patch.deadweightTonnage = input.deadweightTonnage;
  }
  if (input.netRegisteredTonnage !== undefined) {
    patch.netRegisteredTonnage = input.netRegisteredTonnage;
  }
  if (input.lengthOverall !== undefined) {
    patch.lengthOverall = numToDb(input.lengthOverall);
  }
  if (input.breadth !== undefined) patch.breadth = numToDb(input.breadth);
  if (input.depth !== undefined) patch.depth = numToDb(input.depth);
  if (input.draft !== undefined) patch.draft = numToDb(input.draft);
  if (input.mainEngine !== undefined) patch.mainEngine = input.mainEngine;
  if (input.auxEngines !== undefined) patch.auxEngines = input.auxEngines;
  if (input.cargoCapacity !== undefined) {
    patch.cargoCapacity = numToDb(input.cargoCapacity);
  }
  if (input.ballastCapacity !== undefined) {
    patch.ballastCapacity = numToDb(input.ballastCapacity);
  }
  if (input.fuelOilCapacity !== undefined) {
    patch.fuelOilCapacity = numToDb(input.fuelOilCapacity);
  }
  if (input.freshWaterCapacity !== undefined) {
    patch.freshWaterCapacity = numToDb(input.freshWaterCapacity);
  }
  if (input.effectiveDate !== undefined) {
    patch.effectiveDate = input.effectiveDate;
  }
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.isCurrent !== undefined) patch.isCurrent = input.isCurrent;
  return patch;
}

export async function listVesselParticularsSummary(
  ctx: AccessContext,
): Promise<ParticularsSummaryItem[]> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();

  const vesselRows = await db
    .select({ id: vessels.id, name: vessels.name })
    .from(vessels)
    .orderBy(asc(vessels.name));

  const currentRows = await db
    .select()
    .from(vesselParticulars)
    .where(eq(vesselParticulars.isCurrent, true));

  const byVessel = new Map(currentRows.map((r) => [r.vesselId, r]));

  return vesselRows.map((v) => {
    const p = byVessel.get(v.id);
    return {
      vesselId: v.id,
      vesselName: v.name,
      particularsId: p?.id ?? null,
      classSociety: p?.classSociety ?? null,
      deadweightTonnage: p?.deadweightTonnage ?? null,
      lengthOverall: p?.lengthOverall ?? null,
      effectiveDate: p?.effectiveDate ?? null,
    };
  });
}

export type ParticularsListFilters = {
  vesselId?: string;
  isCurrent?: boolean;
};

export async function listParticulars(
  ctx: AccessContext,
  filters: ParticularsListFilters = {},
): Promise<VesselParticularsRow[]> {
  assertAuthenticatedAccess(ctx);
  const conditions: SQL[] = [];
  if (filters.vesselId) {
    conditions.push(eq(vesselParticulars.vesselId, filters.vesselId));
  }
  if (filters.isCurrent !== undefined) {
    conditions.push(eq(vesselParticulars.isCurrent, filters.isCurrent));
  }
  return getDb()
    .select()
    .from(vesselParticulars)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(vesselParticulars.createdAt));
}

export async function getParticularsById(
  ctx: AccessContext,
  id: string,
): Promise<
  | (VesselParticularsRow & {
      vesselName: string;
      attachments: VesselParticularsAttachmentRow[];
    })
  | undefined
> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const rows = await db
    .select({
      particulars: vesselParticulars,
      vesselName: vessels.name,
    })
    .from(vesselParticulars)
    .innerJoin(vessels, eq(vesselParticulars.vesselId, vessels.id))
    .where(eq(vesselParticulars.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  const attachments = await db
    .select()
    .from(vesselParticularsAttachments)
    .where(eq(vesselParticularsAttachments.particularsId, id))
    .orderBy(asc(vesselParticularsAttachments.uploadedAt));
  return {
    ...row.particulars,
    vesselName: row.vesselName,
    attachments,
  };
}

export async function getCurrentParticulars(
  ctx: AccessContext,
  vesselId: string,
): Promise<ParticularsCurrentDetail | undefined> {
  assertAuthenticatedAccess(ctx, vesselId);
  const db = getDb();
  const vesselRows = await db
    .select({ id: vessels.id, name: vessels.name })
    .from(vessels)
    .where(eq(vessels.id, vesselId))
    .limit(1);
  if (!vesselRows[0]) return undefined;

  const rows = await db
    .select()
    .from(vesselParticulars)
    .where(
      and(
        eq(vesselParticulars.vesselId, vesselId),
        eq(vesselParticulars.isCurrent, true),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }

  const attachments = await db
    .select()
    .from(vesselParticularsAttachments)
    .where(eq(vesselParticularsAttachments.particularsId, row.id))
    .orderBy(asc(vesselParticularsAttachments.uploadedAt));

  return {
    ...row,
    vesselName: vesselRows[0].name,
    attachments,
  };
}

export async function listParticularsHistory(
  ctx: AccessContext,
  vesselId: string,
): Promise<VesselParticularsRow[]> {
  assertAuthenticatedAccess(ctx, vesselId);
  return getDb()
    .select()
    .from(vesselParticulars)
    .where(eq(vesselParticulars.vesselId, vesselId))
    .orderBy(desc(vesselParticulars.createdAt));
}

export async function getParticularsForVessel(
  ctx: AccessContext,
  vesselId: string,
): Promise<ParticularsVesselDetail | undefined> {
  assertAuthenticatedAccess(ctx, vesselId);
  const db = getDb();
  const vesselRows = await db
    .select({ id: vessels.id, name: vessels.name })
    .from(vessels)
    .where(eq(vessels.id, vesselId))
    .limit(1);
  if (!vesselRows[0]) return undefined;

  const history = await listParticularsHistory(ctx, vesselId);
  const currentRow = history.find((r) => r.isCurrent) ?? null;
  let current: ParticularsCurrentDetail | null = null;
  if (currentRow) {
    const attachments = await db
      .select()
      .from(vesselParticularsAttachments)
      .where(eq(vesselParticularsAttachments.particularsId, currentRow.id))
      .orderBy(asc(vesselParticularsAttachments.uploadedAt));
    current = {
      ...currentRow,
      vesselName: vesselRows[0].name,
      attachments,
    };
  }

  return {
    vesselId,
    vesselName: vesselRows[0].name,
    current,
    history,
  };
}

export async function createParticulars(
  ctx: AccessContext,
  input: ParticularsCreateInput,
): Promise<VesselParticularsRow> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  const makeCurrent = input.isCurrent !== false;
  const values = {
    ...valuesFromInput(input),
    vesselId: input.vesselId,
    isCurrent: makeCurrent,
  };

  let row: VesselParticularsRow;
  try {
    if (makeCurrent) {
      row = await db.transaction(async (tx) => {
        await tx
          .update(vesselParticulars)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(eq(vesselParticulars.vesselId, input.vesselId));

        const inserted = await tx
          .insert(vesselParticulars)
          .values(values)
          .returning();
        const insertedRow = inserted[0];
        if (!insertedRow) throw new Error("Particulars insert did not return a row");
        return insertedRow;
      });
    } else {
      const inserted = await db.insert(vesselParticulars).values(values).returning();
      const insertedRow = inserted[0];
      if (!insertedRow) throw new Error("Particulars insert did not return a row");
      row = insertedRow;
    }
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new ParticularsConflictError("Vessel reference is invalid.");
    }
    logError("PARTICULARS_CREATE_FAILED", { error });
    throw error;
  }
  const descParts = ["Added ship particulars"];
  if (row.effectiveDate) descParts.push(`effective ${row.effectiveDate}`);
  if (row.owner) descParts.push(`owner ${row.owner}`);
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "particulars",
    recordId: row.id,
    description: descParts.join(" — "),
  });
  return row;
}

export async function updateParticulars(
  ctx: AccessContext,
  id: string,
  input: ParticularsUpdateInput,
): Promise<VesselParticularsRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const existing = await db
    .select()
    .from(vesselParticulars)
    .where(eq(vesselParticulars.id, id))
    .limit(1);
  const current = existing[0];
  if (!current) throw new ParticularsNotFoundError(id);

  const patch = {
    ...valuesFromInput(input),
    updatedAt: new Date(),
  };
  const vesselId = input.vesselId ?? current.vesselId;
  const makeCurrent = input.isCurrent === true;

  let row: VesselParticularsRow;
  try {
    if (makeCurrent) {
      row = await db.transaction(async (tx) => {
        await tx
          .update(vesselParticulars)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(eq(vesselParticulars.vesselId, vesselId));

        const updated = await tx
          .update(vesselParticulars)
          .set({ ...patch, vesselId, isCurrent: true })
          .where(eq(vesselParticulars.id, id))
          .returning();
        const updatedRow = updated[0];
        if (!updatedRow) throw new ParticularsNotFoundError(id);
        return updatedRow;
      });
    } else {
      const updated = await db
        .update(vesselParticulars)
        .set(patch)
        .where(eq(vesselParticulars.id, id))
        .returning();
      const updatedRow = updated[0];
      if (!updatedRow) throw new ParticularsNotFoundError(id);
      row = updatedRow;
    }
  } catch (error) {
    if (error instanceof ParticularsNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new ParticularsConflictError("Vessel reference is invalid.");
    }
    logError("PARTICULARS_UPDATE_FAILED", { error, particularsId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "particulars",
    recordId: row.id,
    description: row.effectiveDate
      ? `Updated ship particulars (effective ${row.effectiveDate})`
      : "Updated ship particulars",
  });
  return row;
}

export async function deleteParticulars(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const existing = await db
    .select({
      effectiveDate: vesselParticulars.effectiveDate,
      owner: vesselParticulars.owner,
    })
    .from(vesselParticulars)
    .where(eq(vesselParticulars.id, id))
    .limit(1);
  const meta = existing[0];
  try {
    const atts = await db
      .select()
      .from(vesselParticularsAttachments)
      .where(eq(vesselParticularsAttachments.particularsId, id));
    for (const att of atts) {
      await removeStoredAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(vesselParticulars)
      .where(eq(vesselParticulars.id, id))
      .returning({ id: vesselParticulars.id });
    if (deleted.length === 0) throw new ParticularsNotFoundError(id);
  } catch (error) {
    if (error instanceof ParticularsNotFoundError) throw error;
    logError("PARTICULARS_DELETE_FAILED", { error, particularsId: id });
    throw error;
  }
  const descParts = ["Deleted ship particulars"];
  if (meta?.effectiveDate) descParts.push(`effective ${meta.effectiveDate}`);
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "particulars",
    recordId: id,
    description: descParts.join(" — "),
  });
}

export async function listParticularsAttachments(
  ctx: AccessContext,
  particularsId: string,
): Promise<VesselParticularsAttachmentRow[]> {
  assertAuthenticatedAccess(ctx, particularsId);
  return getDb()
    .select()
    .from(vesselParticularsAttachments)
    .where(eq(vesselParticularsAttachments.particularsId, particularsId))
    .orderBy(asc(vesselParticularsAttachments.uploadedAt));
}

export async function uploadParticularsAttachment(
  ctx: AccessContext,
  particularsId: string,
  file: { name: string; type: string; size: number; bytes: Buffer },
): Promise<VesselParticularsAttachmentRow> {
  assertAuthenticatedAccess(ctx, particularsId);

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
  let row: VesselParticularsAttachmentRow;
  try {
    const parent = await db
      .select({ id: vesselParticulars.id })
      .from(vesselParticulars)
      .where(eq(vesselParticulars.id, particularsId))
      .limit(1);
    if (!parent[0]) throw new ParticularsNotFoundError(particularsId);

    await mkdir(ATTACHMENTS_DIR, { recursive: true });
    const id = randomUUID();
    const storedName = `${id}${extensionForMime(file.type)}`;
    const absolute = path.join(ATTACHMENTS_DIR, storedName);
    const relativePath = path
      .join("data", "attachments", storedName)
      .replace(/\\/g, "/");
    await writeFile(absolute, file.bytes);

    const inserted = await db
      .insert(vesselParticularsAttachments)
      .values({
        id,
        particularsId,
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
      error instanceof ParticularsNotFoundError ||
      error instanceof AttachmentValidationError
    ) {
      throw error;
    }
    logError("PARTICULARS_ATTACHMENT_UPLOAD_FAILED", {
      error,
      particularsId,
    });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "uploaded",
    moduleName: "particulars",
    recordId: particularsId,
    description: `Uploaded attachment to ship particulars: ${row.fileName}`,
  });
  return row;
}

export async function deleteParticularsAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(vesselParticularsAttachments)
      .where(eq(vesselParticularsAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AttachmentNotFoundError(attachmentId);
    await db
      .delete(vesselParticularsAttachments)
      .where(eq(vesselParticularsAttachments.id, attachmentId));
    await removeStoredAttachmentFile(row.filePath);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    logError("PARTICULARS_ATTACHMENT_DELETE_FAILED", {
      error,
      attachmentId,
    });
    throw error;
  }
}

/**
 * Lookup for the generic `/api/attachments/[id]` resolver.
 * Does not write access_logs — particulars are out of GDPR access-log
 * scope (SECURITY_PLAN.md §6b is Crew-only).
 */
export async function getParticularsAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<VesselParticularsAttachmentRow | undefined> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const rows = await getDb()
    .select()
    .from(vesselParticularsAttachments)
    .where(eq(vesselParticularsAttachments.id, attachmentId))
    .limit(1);
  return rows[0];
}
