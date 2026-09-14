/**
 * Vessel notes data-access (`PROJECT_PLAN.md` §13).
 *
 * Append-only log — create, list, delete only (no update).
 * UI deferred to the vessel-detail integration pass.
 */
import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vesselNotes, vessels, type VesselNoteRow } from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import { logError } from "@/lib/logging";

export class VesselNoteNotFoundError extends Error {
  readonly code = "VESSEL_NOTE_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Vessel note not found: ${id}`);
    this.name = "VesselNoteNotFoundError";
  }
}

export class VesselNoteConflictError extends Error {
  readonly code = "VESSEL_NOTE_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "VesselNoteConflictError";
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

export async function listVesselNotes(
  ctx: AccessContext,
  vesselId: string,
): Promise<VesselNoteRow[]> {
  assertAuthenticatedAccess(ctx, vesselId);
  return getDb()
    .select()
    .from(vesselNotes)
    .where(eq(vesselNotes.vesselId, vesselId))
    .orderBy(desc(vesselNotes.createdAt));
}

export async function createVesselNote(
  ctx: AccessContext,
  vesselId: string,
  body: string,
): Promise<VesselNoteRow> {
  assertAuthenticatedAccess(ctx, vesselId);
  const db = getDb();

  const vessel = await db
    .select({ id: vessels.id })
    .from(vessels)
    .where(eq(vessels.id, vesselId))
    .limit(1);
  if (!vessel[0]) {
    throw new VesselNoteConflictError("Vessel reference is invalid.");
  }

  let row: VesselNoteRow;
  try {
    const inserted = await db
      .insert(vesselNotes)
      .values({
        vesselId,
        body,
        authorId: ctx.userId,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) throw new Error("Vessel note insert did not return a row");
    row = insertedRow;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new VesselNoteConflictError("Vessel reference is invalid.");
    }
    logError("VESSEL_NOTE_CREATE_FAILED", { error, vesselId });
    throw error;
  }
  const preview =
    row.body.length > 80 ? `${row.body.slice(0, 77)}...` : row.body;
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "particulars",
    recordId: row.id,
    description: `Added vessel note: ${preview}`,
  });
  return row;
}

export async function deleteVesselNote(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  try {
    const deleted = await getDb()
      .delete(vesselNotes)
      .where(eq(vesselNotes.id, id))
      .returning({ id: vesselNotes.id });
    if (deleted.length === 0) throw new VesselNoteNotFoundError(id);
  } catch (error) {
    if (error instanceof VesselNoteNotFoundError) throw error;
    logError("VESSEL_NOTE_DELETE_FAILED", { error, noteId: id });
    throw error;
  }
}
