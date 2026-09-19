/**
 * PSC inspection data-access layer.
 *
 * Only file in this module allowed to import drizzle-orm query builders.
 * Spec: PROJECT_PLAN.md §7b.
 */
import "server-only";

import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  pscInspections,
  vessels,
  type PscInspectionResult,
  type PscInspectionRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  assertVesselScope,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import { logError } from "@/lib/logging";
import type { PscInspectionListItem } from "./psc.model";
import type {
  PscInspectionCreateInput,
  PscInspectionUpdateInput,
} from "./validation";

export class PscInspectionNotFoundError extends Error {
  readonly code = "PSC_INSPECTION_NOT_FOUND" as const;
  constructor(id: string) {
    super(`PSC inspection not found: ${id}`);
    this.name = "PscInspectionNotFoundError";
  }
}

export class PscInspectionConflictError extends Error {
  readonly code = "PSC_INSPECTION_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "PscInspectionConflictError";
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

export type PscInspectionListFilters = {
  vesselId?: string;
  result?: PscInspectionResult;
};

/** Lists PSC inspections with vessel name, optional filters. */
export async function listPscInspections(
  ctx: AccessContext,
  filters: PscInspectionListFilters = {},
): Promise<PscInspectionListItem[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "psc", "read");
  const scopedVesselId =
    ctx.role === "management_user" || ctx.role === "vessel_user"
      ? ctx.vesselId ?? undefined
      : filters.vesselId;
  const conditions: SQL[] = [];
  if (scopedVesselId) {
    conditions.push(eq(pscInspections.vesselId, scopedVesselId));
  }
  if (filters.result) {
    conditions.push(eq(pscInspections.result, filters.result));
  }

  const rows = await getDb()
    .select({
      inspection: pscInspections,
      vesselName: vessels.name,
    })
    .from(pscInspections)
    .innerJoin(vessels, eq(pscInspections.vesselId, vessels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      desc(pscInspections.inspectionDate),
      asc(vessels.name),
    );

  return rows.map((row) => ({
    ...row.inspection,
    vesselName: row.vesselName,
  }));
}

/** Detail with vessel name, or `undefined` if missing. */
export async function getPscInspection(
  ctx: AccessContext,
  id: string,
): Promise<PscInspectionListItem | undefined> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "psc", "read");
  const rows = await getDb()
    .select({
      inspection: pscInspections,
      vesselName: vessels.name,
    })
    .from(pscInspections)
    .innerJoin(vessels, eq(pscInspections.vesselId, vessels.id))
    .where(eq(pscInspections.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  assertVesselScope(ctx, row.inspection.vesselId);
  return { ...row.inspection, vesselName: row.vesselName };
}

/** @throws {PscInspectionNotFoundError} */
export async function requirePscInspection(
  ctx: AccessContext,
  id: string,
): Promise<PscInspectionListItem> {
  const row = await getPscInspection(ctx, id);
  if (!row) throw new PscInspectionNotFoundError(id);
  return row;
}

/** Creates a PSC inspection. */
export async function createPscInspection(
  ctx: AccessContext,
  input: PscInspectionCreateInput,
): Promise<PscInspectionRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "psc", "write");
  assertVesselScope(ctx, input.vesselId);
  let row: PscInspectionRow;
  try {
    const inserted = await getDb()
      .insert(pscInspections)
      .values({
        vesselId: input.vesselId,
        port: input.port,
        inspectionDate: input.inspectionDate,
        authority: input.authority,
        result: input.result,
        detained: input.detained,
        inspectorName: input.inspectorName ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) throw new Error("Insert did not return a row");
    row = insertedRow;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new PscInspectionConflictError("Vessel reference is invalid.");
    }
    logError("PSC_INSPECTION_CREATE_FAILED", {
      error,
      vesselId: input.vesselId,
    });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "psc",
    recordId: row.id,
    description: `Added PSC inspection: ${row.port} (${row.inspectionDate})`,
  });
  return row;
}

/** Partial update. */
export async function updatePscInspection(
  ctx: AccessContext,
  id: string,
  input: PscInspectionUpdateInput,
): Promise<PscInspectionRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "psc", "write");
  const db = getDb();
  const existing = await db
    .select()
    .from(pscInspections)
    .where(eq(pscInspections.id, id))
    .limit(1);
  if (!existing[0]) throw new PscInspectionNotFoundError(id);
  assertVesselScope(ctx, existing[0].vesselId);
  if (input.vesselId !== undefined) {
    assertVesselScope(ctx, input.vesselId);
  }

  const patch: Partial<typeof pscInspections.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.port !== undefined) patch.port = input.port;
  if (input.inspectionDate !== undefined) {
    patch.inspectionDate = input.inspectionDate;
  }
  if (input.authority !== undefined) patch.authority = input.authority;
  if (input.result !== undefined) patch.result = input.result;
  if (input.detained !== undefined) patch.detained = input.detained;
  if (input.inspectorName !== undefined) {
    patch.inspectorName = input.inspectorName;
  }
  if (input.notes !== undefined) patch.notes = input.notes;

  let row: PscInspectionRow;
  try {
    const updated = await db
      .update(pscInspections)
      .set(patch)
      .where(eq(pscInspections.id, id))
      .returning();
    const updatedRow = updated[0];
    if (!updatedRow) throw new PscInspectionNotFoundError(id);
    row = updatedRow;
  } catch (error) {
    if (error instanceof PscInspectionNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new PscInspectionConflictError("Vessel reference is invalid.");
    }
    logError("PSC_INSPECTION_UPDATE_FAILED", { error, inspectionId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "psc",
    recordId: row.id,
    description: `Updated PSC inspection: ${row.port} (${row.inspectionDate})`,
  });
  return row;
}

/** Deletes a PSC inspection. Linked deficiencies get psc_inspection_id set null. */
export async function deletePscInspection(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "psc", "write");
  const db = getDb();
  const existing = await db
    .select()
    .from(pscInspections)
    .where(eq(pscInspections.id, id))
    .limit(1);
  if (!existing[0]) throw new PscInspectionNotFoundError(id);
  assertVesselScope(ctx, existing[0].vesselId);

  await db.delete(pscInspections).where(eq(pscInspections.id, id));
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "psc",
    recordId: id,
    description: `Deleted PSC inspection: ${existing[0].port} (${existing[0].inspectionDate})`,
  });
}
