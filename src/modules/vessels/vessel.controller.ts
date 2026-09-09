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
 */
import "server-only";

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vessels, type VesselRow } from "@/db/schema";
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

/** All vessels, alphabetical by name. */
export async function listVessels(): Promise<VesselRow[]> {
  return getDb().select().from(vessels).orderBy(asc(vessels.name));
}

/** A single vessel by id, or `undefined` if it doesn't exist — use this when "not found" is a valid outcome (e.g. `notFound()` in a page). */
export async function getVesselById(id: string): Promise<VesselRow | undefined> {
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
export async function requireVesselById(id: string): Promise<VesselRow> {
  const row = await getVesselById(id);
  if (!row) {
    throw new VesselNotFoundError(id);
  }
  return row;
}

/**
 * Creates a vessel, normalizing optional fields to `null` for storage.
 *
 * @throws {VesselConflictError} if `imoNumber` collides with an existing
 * vessel — IMO numbers are unique fleet-wide, not just per some scope.
 */
export async function createVessel(input: VesselCreateInput): Promise<VesselRow> {
  const db = getDb();
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
    const row = inserted[0];
    if (!row) {
      throw new Error("Insert did not return a row");
    }
    return row;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new VesselConflictError("That IMO number is already assigned to another vessel.");
    }
    throw error;
  }
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
export async function updateVessel(id: string, input: VesselUpdateInput): Promise<VesselRow> {
  const db = getDb();
  const existing = await getVesselById(id);
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

  try {
    const updated = await db
      .update(vessels)
      .set(patch)
      .where(eq(vessels.id, id))
      .returning();
    const row = updated[0];
    if (!row) {
      throw new VesselNotFoundError(id);
    }
    return row;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new VesselConflictError("That IMO number is already assigned to another vessel.");
    }
    throw error;
  }
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
export async function deleteVessel(id: string): Promise<void> {
  const db = getDb();
  const deleted = await db.delete(vessels).where(eq(vessels.id, id)).returning({ id: vessels.id });
  if (deleted.length === 0) {
    throw new VesselNotFoundError(id);
  }
}
