/**
 * Crew member data-access layer (`PROJECT_PLAN.md` §3).
 *
 * Only file (with `crew-certificate.controller.ts`) allowed to import
 * drizzle-orm query builders for this module. Detail reads optionally write
 * GDPR `access_logs` rows — list reads never do.
 */
import "server-only";

import { and, asc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  crewCategories,
  crewMembers,
  endorsementTypes,
  vessels,
  type CrewCategoryRow,
  type CrewMemberRow,
  type CrewStatus,
  type EndorsementTypeRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  assertVesselScope,
  type AccessContext,
} from "@/lib/auth/access";
import { writeAccessLog } from "@/lib/access-log/write";
import { writeActivityLog } from "@/lib/activity-log/write";
import { logError } from "@/lib/logging";
import type { CrewMemberListItem } from "./crew.model";
import type {
  CrewMemberCreateInput,
  CrewMemberUpdateInput,
} from "./validation";
import { CrewMemberNotFoundError } from "./scrub-pii";

export { CrewMemberNotFoundError } from "./scrub-pii";
export { scrubCrewMemberPii } from "./scrub-pii";

export class CrewConflictError extends Error {
  readonly code = "CREW_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "CrewConflictError";
  }
}

export class CrewCategoryNotFoundError extends Error {
  readonly code = "CREW_CATEGORY_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Crew category not found: ${id}`);
    this.name = "CrewCategoryNotFoundError";
  }
}

export class EndorsementTypeNotFoundError extends Error {
  readonly code = "ENDORSEMENT_TYPE_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Endorsement type not found: ${id}`);
    this.name = "EndorsementTypeNotFoundError";
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

export type CrewListFilters = {
  vesselId?: string;
  status?: CrewStatus;
  categoryId?: string;
};

/** Reference lists for forms / Settings later. */
export async function listCrewCategories(
  ctx: AccessContext,
): Promise<CrewCategoryRow[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "crew", "read");
  return getDb()
    .select()
    .from(crewCategories)
    .orderBy(asc(crewCategories.name));
}

export async function listEndorsementTypes(
  ctx: AccessContext,
): Promise<EndorsementTypeRow[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "crew", "read");
  return getDb()
    .select()
    .from(endorsementTypes)
    .orderBy(asc(endorsementTypes.name));
}

export async function createCrewCategory(
  ctx: AccessContext,
  input: { name: string },
): Promise<CrewCategoryRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "settings_general", "write");
  const name = input.name.trim();
  if (name.length === 0) {
    throw new CrewConflictError("Name is required.");
  }
  const db = getDb();
  try {
    const inserted = await db
      .insert(crewCategories)
      .values({ name, isCustom: true })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("Crew category insert did not return a row");
    return row;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new CrewConflictError(
        "A crew category with that name already exists.",
      );
    }
    logError("CREW_CATEGORY_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateCrewCategory(
  ctx: AccessContext,
  id: string,
  input: { name: string },
): Promise<CrewCategoryRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "settings_general", "write");
  const name = input.name.trim();
  if (name.length === 0) {
    throw new CrewConflictError("Name is required.");
  }
  const db = getDb();
  const existing = await db
    .select({ id: crewCategories.id })
    .from(crewCategories)
    .where(eq(crewCategories.id, id))
    .limit(1);
  if (!existing[0]) throw new CrewCategoryNotFoundError(id);

  try {
    const updated = await db
      .update(crewCategories)
      .set({ name })
      .where(eq(crewCategories.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new CrewCategoryNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof CrewCategoryNotFoundError) throw error;
    if (isPgUniqueViolation(error)) {
      throw new CrewConflictError(
        "A crew category with that name already exists.",
      );
    }
    logError("CREW_CATEGORY_UPDATE_FAILED", { error, crewCategoryId: id });
    throw error;
  }
}

export async function deleteCrewCategory(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "settings_general", "write");
  const db = getDb();
  try {
    const deleted = await db
      .delete(crewCategories)
      .where(eq(crewCategories.id, id))
      .returning({ id: crewCategories.id });
    if (deleted.length === 0) throw new CrewCategoryNotFoundError(id);
  } catch (error) {
    if (error instanceof CrewCategoryNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new CrewConflictError(
        "Cannot delete: this crew category is still referenced by crew members.",
      );
    }
    logError("CREW_CATEGORY_DELETE_FAILED", { error, crewCategoryId: id });
    throw error;
  }
}

export async function createEndorsementType(
  ctx: AccessContext,
  input: { name: string },
): Promise<EndorsementTypeRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "settings_general", "write");
  const name = input.name.trim();
  if (name.length === 0) {
    throw new CrewConflictError("Name is required.");
  }
  const db = getDb();
  try {
    const inserted = await db
      .insert(endorsementTypes)
      .values({ name, isCustom: true })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("Endorsement type insert did not return a row");
    return row;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new CrewConflictError(
        "An endorsement type with that name already exists.",
      );
    }
    logError("ENDORSEMENT_TYPE_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateEndorsementType(
  ctx: AccessContext,
  id: string,
  input: { name: string },
): Promise<EndorsementTypeRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "settings_general", "write");
  const name = input.name.trim();
  if (name.length === 0) {
    throw new CrewConflictError("Name is required.");
  }
  const db = getDb();
  const existing = await db
    .select({ id: endorsementTypes.id })
    .from(endorsementTypes)
    .where(eq(endorsementTypes.id, id))
    .limit(1);
  if (!existing[0]) throw new EndorsementTypeNotFoundError(id);

  try {
    const updated = await db
      .update(endorsementTypes)
      .set({ name })
      .where(eq(endorsementTypes.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new EndorsementTypeNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof EndorsementTypeNotFoundError) throw error;
    if (isPgUniqueViolation(error)) {
      throw new CrewConflictError(
        "An endorsement type with that name already exists.",
      );
    }
    logError("ENDORSEMENT_TYPE_UPDATE_FAILED", {
      error,
      endorsementTypeId: id,
    });
    throw error;
  }
}

export async function deleteEndorsementType(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "settings_general", "write");
  const db = getDb();
  try {
    const deleted = await db
      .delete(endorsementTypes)
      .where(eq(endorsementTypes.id, id))
      .returning({ id: endorsementTypes.id });
    if (deleted.length === 0) throw new EndorsementTypeNotFoundError(id);
  } catch (error) {
    if (error instanceof EndorsementTypeNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new CrewConflictError(
        "Cannot delete: this endorsement type is still referenced by crew certificates.",
      );
    }
    logError("ENDORSEMENT_TYPE_DELETE_FAILED", {
      error,
      endorsementTypeId: id,
    });
    throw error;
  }
}

/**
 * Lists crew members. Does **not** write access_logs — list shows only
 * names/status, not the personal-data fields the GDPR log tracks.
 */
export async function listCrewMembers(
  ctx: AccessContext,
  filters: CrewListFilters = {},
): Promise<CrewMemberListItem[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "crew", "read");
  const scopedVesselId =
    ctx.role === "management_user" || ctx.role === "vessel_user"
      ? ctx.vesselId ?? undefined
      : filters.vesselId;
  const db = getDb();
  const conditions: SQL[] = [];
  if (scopedVesselId) {
    conditions.push(eq(crewMembers.vesselId, scopedVesselId));
  }
  if (filters.status) {
    conditions.push(eq(crewMembers.status, filters.status));
  }
  if (filters.categoryId) {
    conditions.push(eq(crewMembers.categoryId, filters.categoryId));
  }

  const rows = await db
    .select({
      member: crewMembers,
      vesselName: vessels.name,
      categoryName: crewCategories.name,
    })
    .from(crewMembers)
    .leftJoin(vessels, eq(crewMembers.vesselId, vessels.id))
    .leftJoin(crewCategories, eq(crewMembers.categoryId, crewCategories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(crewMembers.lastName), asc(crewMembers.firstName));

  return rows.map((r) => ({
    ...r.member,
    vesselName: r.vesselName,
    categoryName: r.categoryName,
  }));
}

export type GetCrewMemberOptions = {
  /** When true, appends an `access_logs` view row (detail page / API GET). */
  logView?: boolean;
};

/**
 * Loads one crew member with joins. Pass `logView: true` from detail pages.
 */
export async function getCrewMemberById(
  ctx: AccessContext,
  id: string,
  options: GetCrewMemberOptions = {},
): Promise<CrewMemberListItem | undefined> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "crew", "read");
  const db = getDb();
  const rows = await db
    .select({
      member: crewMembers,
      vesselName: vessels.name,
      categoryName: crewCategories.name,
    })
    .from(crewMembers)
    .leftJoin(vessels, eq(crewMembers.vesselId, vessels.id))
    .leftJoin(crewCategories, eq(crewMembers.categoryId, crewCategories.id))
    .where(eq(crewMembers.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  assertVesselScope(ctx, row.member.vesselId);

  if (options.logView) {
    await writeAccessLog({
      userId: ctx.userId,
      moduleName: "crew",
      recordId: id,
      accessType: "view",
    });
  }

  return {
    ...row.member,
    vesselName: row.vesselName,
    categoryName: row.categoryName,
  };
}

export async function createCrewMember(
  ctx: AccessContext,
  input: CrewMemberCreateInput,
): Promise<CrewMemberRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "crew", "write");
  assertVesselScope(ctx, input.vesselId ?? null);
  const db = getDb();
  let row: CrewMemberRow;
  try {
    const inserted = await db
      .insert(crewMembers)
      .values({
        firstName: input.firstName,
        lastName: input.lastName,
        categoryId: input.categoryId ?? null,
        nationality: input.nationality ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        vesselId: input.vesselId ?? null,
        status: input.status,
        notes: input.notes ?? null,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) throw new Error("Crew member insert did not return a row");
    row = insertedRow;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new CrewConflictError(
        "Vessel or category reference is invalid.",
      );
    }
    logError("CREW_MEMBER_CREATE_FAILED", { error });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "crew",
    recordId: row.id,
    description: `Added crew member: ${row.firstName} ${row.lastName}`,
  });
  return row;
}

export async function updateCrewMember(
  ctx: AccessContext,
  id: string,
  input: CrewMemberUpdateInput,
): Promise<CrewMemberRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "crew", "write");
  const db = getDb();

  const existing = await db
    .select({ id: crewMembers.id, vesselId: crewMembers.vesselId })
    .from(crewMembers)
    .where(eq(crewMembers.id, id))
    .limit(1);
  if (!existing[0]) throw new CrewMemberNotFoundError(id);
  assertVesselScope(ctx, existing[0].vesselId);

  const patch: Partial<typeof crewMembers.$inferInsert> & {
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (input.firstName !== undefined) patch.firstName = input.firstName;
  if (input.lastName !== undefined) patch.lastName = input.lastName;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.nationality !== undefined) patch.nationality = input.nationality;
  if (input.dateOfBirth !== undefined) patch.dateOfBirth = input.dateOfBirth;
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;

  let row: CrewMemberRow;
  try {
    const updated = await db
      .update(crewMembers)
      .set(patch)
      .where(eq(crewMembers.id, id))
      .returning();
    const updatedRow = updated[0];
    if (!updatedRow) throw new CrewMemberNotFoundError(id);
    row = updatedRow;
  } catch (error) {
    if (error instanceof CrewMemberNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new CrewConflictError(
        "Vessel or category reference is invalid.",
      );
    }
    logError("CREW_MEMBER_UPDATE_FAILED", { error, crewMemberId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "crew",
    recordId: row.id,
    description: `Updated crew member: ${row.firstName} ${row.lastName}`,
  });
  return row;
}

/** Hard-delete — blocked while certificates remain (RESTRICT). */
export async function deleteCrewMember(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "crew", "write");
  const db = getDb();
  const existing = await db
    .select({
      firstName: crewMembers.firstName,
      lastName: crewMembers.lastName,
      vesselId: crewMembers.vesselId,
    })
    .from(crewMembers)
    .where(eq(crewMembers.id, id))
    .limit(1);
  if (!existing[0]) throw new CrewMemberNotFoundError(id);
  assertVesselScope(ctx, existing[0].vesselId);
  const name = `${existing[0].firstName} ${existing[0].lastName}`;
  try {
    const deleted = await db
      .delete(crewMembers)
      .where(eq(crewMembers.id, id))
      .returning({ id: crewMembers.id });
    if (deleted.length === 0) throw new CrewMemberNotFoundError(id);
  } catch (error) {
    if (error instanceof CrewMemberNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new CrewConflictError(
        "Delete or scrub certificates before removing this crew member.",
      );
    }
    logError("CREW_MEMBER_DELETE_FAILED", { error, crewMemberId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "crew",
    recordId: id,
    description: name
      ? `Deleted crew member: ${name}`
      : "Deleted crew member",
  });
}
