import "server-only";

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vessels, type VesselRow } from "@/db/schema";
import type { VesselCreateInput, VesselUpdateInput } from "./validation";

export class VesselNotFoundError extends Error {
  readonly code = "VESSEL_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Vessel not found: ${id}`);
    this.name = "VesselNotFoundError";
  }
}

export class VesselConflictError extends Error {
  readonly code = "VESSEL_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "VesselConflictError";
  }
}

function isSqliteUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

export function listVessels(): VesselRow[] {
  return getDb().select().from(vessels).orderBy(asc(vessels.name)).all();
}

export function getVesselById(id: string): VesselRow | undefined {
  return getDb().select().from(vessels).where(eq(vessels.id, id)).get();
}

export function requireVesselById(id: string): VesselRow {
  const row = getVesselById(id);
  if (!row) {
    throw new VesselNotFoundError(id);
  }
  return row;
}

export function createVessel(input: VesselCreateInput): VesselRow {
  const db = getDb();
  const ts = nowIso();
  try {
    const inserted = db
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
        createdAt: ts,
        updatedAt: ts,
      })
      .returning()
      .get();
    if (!inserted) {
      throw new Error("Insert did not return a row");
    }
    return inserted;
  } catch (error) {
    if (isSqliteUniqueError(error)) {
      throw new VesselConflictError("That IMO number is already assigned to another vessel.");
    }
    throw error;
  }
}

export function updateVessel(id: string, input: VesselUpdateInput): VesselRow {
  const db = getDb();
  const existing = getVesselById(id);
  if (!existing) {
    throw new VesselNotFoundError(id);
  }

  const patch: Partial<typeof vessels.$inferInsert> = {
    updatedAt: nowIso(),
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
    const updated = db
      .update(vessels)
      .set(patch)
      .where(eq(vessels.id, id))
      .returning()
      .get();
    if (!updated) {
      throw new VesselNotFoundError(id);
    }
    return updated;
  } catch (error) {
    if (isSqliteUniqueError(error)) {
      throw new VesselConflictError("That IMO number is already assigned to another vessel.");
    }
    throw error;
  }
}

export function deleteVessel(id: string): void {
  const db = getDb();
  const result = db.delete(vessels).where(eq(vessels.id, id)).run();
  if (result.changes === 0) {
    throw new VesselNotFoundError(id);
  }
}
