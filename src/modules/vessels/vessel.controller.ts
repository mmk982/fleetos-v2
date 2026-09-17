/**
 * Vessel data-access layer.
 *
 * Every function here talks directly to the database via `getDb()` — this is
 * the only file in the vessels module allowed to import `drizzle-orm` query
 * builders. Callers (`actions.ts`, API routes) never construct queries
 * themselves; they call these functions and handle the typed errors below.
 * This is the reference shape every later module's `<singular>.controller.ts`
 * copies — see `PROJECT_PLAN.md`'s "Conventions" section and
 * `CODE_CONVENTIONS.md`.
 *
 * All exports are `async` since `drizzle-orm/node-postgres` is promise-based
 * (Phase 2 SQLite → Postgres migration — previously sync via better-sqlite3).
 *
 * Every public method takes {@link AccessContext} and calls
 * {@link assertAuthenticatedAccess} then {@link assertModuleAccess}
 * (`MASTER_IMPLEMENTATION_PLAN.md` Phase 3 / Phase 6). No vessel-scope gate —
 * vessel CRUD is office-role only via the vessels module matrix.
 */
import "server-only";

import { asc, count, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vessels, type VesselRow } from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import { logError } from "@/lib/logging";
import type { VesselCreateInput, VesselUpdateInput } from "./validation";

/** Thrown by `requireVesselById`/`updateVessel`/`deleteVessel` when the id doesn't exist. */
export class VesselNotFoundError extends Error {
  readonly code = "VESSEL_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Vessel not found: ${id}`);
    this.name = "VesselNotFoundError";
  }
}

/** Thrown by `createVessel`/`updateVessel` when `imoNumber` collides with an existing vessel. */
export class VesselConflictError extends Error {
  readonly code = "VESSEL_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "VesselConflictError";
  }
}

/** True if `error` is a Postgres unique-constraint violation (SQLSTATE `23505`). */
function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

/**
 * All vessels, alphabetical by name.
 *
 * @param ctx - Authenticated caller (third defense layer).
 */
export async function listVessels(ctx: AccessContext): Promise<VesselRow[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "vessels", "read");
  return getDb().select().from(vessels).orderBy(asc(vessels.name));
}

/** Fleet size — unfiltered vessel count for Dashboard summary cards. */
export async function getVesselCount(ctx: AccessContext): Promise<number> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "vessels", "read");
  const rows = await getDb().select({ n: count() }).from(vessels);
  return rows[0]?.n ?? 0;
}

/**
 * A single vessel by id, or `undefined` if it doesn't exist — use this when
 * "not found" is a valid outcome (e.g. `notFound()` in a page).
 *
 * @param ctx - Authenticated caller.
 * @param id - Vessel primary key.
 */
export async function getVesselById(
  ctx: AccessContext,
  id: string,
): Promise<VesselRow | undefined> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "vessels", "read");
  const rows = await getDb().select().from(vessels).where(eq(vessels.id, id)).limit(1);
  return rows[0];
}

/**
 * A single vessel by id, throwing if it doesn't exist — use this when the
 * caller has already established the vessel must exist (e.g. after an FK
 * check elsewhere) and a missing row is a bug, not an expected case.
 *
 * @throws {VesselNotFoundError}
 */
export async function requireVesselById(ctx: AccessContext, id: string): Promise<VesselRow> {
  const row = await getVesselById(ctx, id);
  if (!row) {
    throw new VesselNotFoundError(id);
  }
  return row;
}

/**
 * Creates a vessel, normalizing optional fields to `null` for storage.
 *
 * @param ctx - Authenticated caller.
 * @throws {VesselConflictError} if `imoNumber` collides with an existing
 * vessel — IMO numbers are unique fleet-wide, not just per some scope.
 */
export async function createVessel(
  ctx: AccessContext,
  input: VesselCreateInput,
): Promise<VesselRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "vessels", "write");
  const db = getDb();
  let row: VesselRow;
  try {
    const inserted = await db
      .insert(vessels)
      .values({
        name: input.name,
        imoNumber: input.imoNumber ?? null,
        mmsi: input.mmsi ?? null,
        callSign: input.callSign ?? null,
        flagState: input.flagState ?? null,
        vesselType: input.vesselType ?? null,
        grossTonnage: input.grossTonnage ?? null,
        yearBuilt: input.yearBuilt ?? null,
        status: input.status,
        notes: input.notes ?? null,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) {
      throw new Error("Insert did not return a row");
    }
    row = insertedRow;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new VesselConflictError("That IMO number is already assigned to another vessel.");
    }
    logError("VESSEL_CREATE_FAILED", { error, imoNumber: input.imoNumber ?? null });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "vessel",
    recordId: row.id,
    description: `Added vessel: ${row.name}`,
  });
  return row;
}

/**
 * Applies a partial update to a vessel. Only keys present in `input` are
 * changed — `undefined` means "leave as-is," which is why this checks
 * `!== undefined` per field rather than spreading `input` directly (spreading
 * would overwrite untouched columns with `undefined`).
 *
 * @throws {VesselNotFoundError} if `id` doesn't exist.
 * @throws {VesselConflictError} if the update's `imoNumber` collides with a
 * different vessel.
 */
export async function updateVessel(
  ctx: AccessContext,
  id: string,
  input: VesselUpdateInput,
): Promise<VesselRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "vessels", "write");
  const db = getDb();
  const existing = await getVesselById(ctx, id);
  if (!existing) {
    throw new VesselNotFoundError(id);
  }

  const patch: Partial<typeof vessels.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.imoNumber !== undefined) {
    patch.imoNumber = input.imoNumber;
  }
  if (input.mmsi !== undefined) {
    patch.mmsi = input.mmsi;
  }
  if (input.callSign !== undefined) {
    patch.callSign = input.callSign;
  }
  if (input.flagState !== undefined) {
    patch.flagState = input.flagState;
  }
  if (input.vesselType !== undefined) {
    patch.vesselType = input.vesselType;
  }
  if (input.grossTonnage !== undefined) {
    patch.grossTonnage = input.grossTonnage;
  }
  if (input.yearBuilt !== undefined) {
    patch.yearBuilt = input.yearBuilt;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  let row: VesselRow;
  try {
    const updated = await db
      .update(vessels)
      .set(patch)
      .where(eq(vessels.id, id))
      .returning();
    const updatedRow = updated[0];
    if (!updatedRow) {
      throw new VesselNotFoundError(id);
    }
    row = updatedRow;
  } catch (error) {
    if (error instanceof VesselNotFoundError) {
      throw error;
    }
    if (isPgUniqueViolation(error)) {
      throw new VesselConflictError("That IMO number is already assigned to another vessel.");
    }
    logError("VESSEL_UPDATE_FAILED", { error, vesselId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "vessel",
    recordId: row.id,
    description: `Updated vessel: ${row.name}`,
  });
  return row;
}

/**
 * Hard-deletes a vessel row.
 *
 * Note for future modules: once Certificates/Deficiencies/Crew/Insurance
 * exist, `vesselId` on those tables is `ON DELETE RESTRICT`
 * (`PROJECT_PLAN.md` §0.9) — deleting a vessel that still has real content
 * pointing at it will fail at the database level, not silently cascade.
 * This function doesn't pre-check for that; it surfaces whatever the
 * database itself decides.
 *
 * @throws {VesselNotFoundError} if `id` doesn't exist.
 */
export async function deleteVessel(ctx: AccessContext, id: string): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "vessels", "write");
  const db = getDb();
  const existing = await getVesselById(ctx, id);
  const name = existing?.name;
  try {
    const deleted = await db.delete(vessels).where(eq(vessels.id, id)).returning({ id: vessels.id });
    if (deleted.length === 0) {
      throw new VesselNotFoundError(id);
    }
  } catch (error) {
    if (error instanceof VesselNotFoundError) {
      throw error;
    }
    logError("VESSEL_DELETE_FAILED", { error, vesselId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "vessel",
    recordId: id,
    description: name ? `Deleted vessel: ${name}` : "Deleted vessel",
  });
}
