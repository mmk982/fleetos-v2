/**
 * Audit data-access layer.
 *
 * Only file in this module allowed to import drizzle-orm query builders.
 * Standalone event log — no FK to deficiencies.
 */
import "server-only";

import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  audits,
  vessels,
  type AuditRow,
  type AuditType,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  assertVesselScope,
  requireScopedVesselId,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import { logError } from "@/lib/logging";
import type { AuditListItem } from "./audit.model";
import type { AuditCreateInput, AuditUpdateInput } from "./validation";

export class AuditNotFoundError extends Error {
  readonly code = "AUDIT_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Audit not found: ${id}`);
    this.name = "AuditNotFoundError";
  }
}

export class AuditConflictError extends Error {
  readonly code = "AUDIT_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "AuditConflictError";
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

export type AuditListFilters = {
  vesselId?: string;
  auditType?: AuditType;
};

/** Lists audits with vessel name, optional filters. */
export async function listAudits(
  ctx: AccessContext,
  filters: AuditListFilters = {},
): Promise<AuditListItem[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "audits", "read");
  const scopedVesselId = requireScopedVesselId(ctx) ?? filters.vesselId;
  const conditions: SQL[] = [];
  if (scopedVesselId) {
    conditions.push(eq(audits.vesselId, scopedVesselId));
  }
  if (filters.auditType) {
    conditions.push(eq(audits.auditType, filters.auditType));
  }

  const rows = await getDb()
    .select({
      audit: audits,
      vesselName: vessels.name,
    })
    .from(audits)
    .innerJoin(vessels, eq(audits.vesselId, vessels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(audits.auditDate), asc(vessels.name));

  return rows.map((row) => ({
    ...row.audit,
    vesselName: row.vesselName,
  }));
}

/** Detail with vessel name, or `undefined` if missing. */
export async function getAudit(
  ctx: AccessContext,
  id: string,
): Promise<AuditListItem | undefined> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "audits", "read");
  const rows = await getDb()
    .select({
      audit: audits,
      vesselName: vessels.name,
    })
    .from(audits)
    .innerJoin(vessels, eq(audits.vesselId, vessels.id))
    .where(eq(audits.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  assertVesselScope(ctx, row.audit.vesselId);
  return { ...row.audit, vesselName: row.vesselName };
}

/** @throws {AuditNotFoundError} */
export async function requireAudit(
  ctx: AccessContext,
  id: string,
): Promise<AuditListItem> {
  const row = await getAudit(ctx, id);
  if (!row) throw new AuditNotFoundError(id);
  return row;
}

/** Creates an audit. */
export async function createAudit(
  ctx: AccessContext,
  input: AuditCreateInput,
): Promise<AuditRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "audits", "write");
  assertVesselScope(ctx, input.vesselId);
  let row: AuditRow;
  try {
    const inserted = await getDb()
      .insert(audits)
      .values({
        vesselId: input.vesselId,
        auditType: input.auditType,
        auditDate: input.auditDate,
        auditor: input.auditor ?? null,
        findingsCount: input.findingsCount,
        notes: input.notes ?? null,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) throw new Error("Insert did not return a row");
    row = insertedRow;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new AuditConflictError("Vessel reference is invalid.");
    }
    logError("AUDIT_CREATE_FAILED", {
      error,
      vesselId: input.vesselId,
    });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "audits",
    recordId: row.id,
    description: `Logged ${row.auditType} audit: ${row.auditDate}`,
  });
  return row;
}

/** Partial update. */
export async function updateAudit(
  ctx: AccessContext,
  id: string,
  input: AuditUpdateInput,
): Promise<AuditRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "audits", "write");
  const db = getDb();
  const existing = await db
    .select()
    .from(audits)
    .where(eq(audits.id, id))
    .limit(1);
  if (!existing[0]) throw new AuditNotFoundError(id);
  assertVesselScope(ctx, existing[0].vesselId);
  if (input.vesselId !== undefined) {
    assertVesselScope(ctx, input.vesselId);
  }

  const patch: Partial<typeof audits.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.auditType !== undefined) patch.auditType = input.auditType;
  if (input.auditDate !== undefined) patch.auditDate = input.auditDate;
  if (input.auditor !== undefined) patch.auditor = input.auditor;
  if (input.findingsCount !== undefined) {
    patch.findingsCount = input.findingsCount;
  }
  if (input.notes !== undefined) patch.notes = input.notes;

  let row: AuditRow;
  try {
    const updated = await db
      .update(audits)
      .set(patch)
      .where(eq(audits.id, id))
      .returning();
    const updatedRow = updated[0];
    if (!updatedRow) throw new AuditNotFoundError(id);
    row = updatedRow;
  } catch (error) {
    if (error instanceof AuditNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new AuditConflictError("Vessel reference is invalid.");
    }
    logError("AUDIT_UPDATE_FAILED", { error, auditId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "audits",
    recordId: row.id,
    description: `Updated ${row.auditType} audit: ${row.auditDate}`,
  });
  return row;
}

/** Hard-deletes an audit. Nothing references audits.id. */
export async function deleteAudit(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "audits", "write");
  const db = getDb();
  const existing = await db
    .select()
    .from(audits)
    .where(eq(audits.id, id))
    .limit(1);
  if (!existing[0]) throw new AuditNotFoundError(id);
  assertVesselScope(ctx, existing[0].vesselId);

  await db.delete(audits).where(eq(audits.id, id));
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "audits",
    recordId: id,
    description: `Deleted ${existing[0].auditType} audit: ${existing[0].auditDate}`,
  });
}
