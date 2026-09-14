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
  type AccessContext,
} from "@/lib/auth/access";
import { writeAccessLog } from "@/lib/access-log/write";
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

function isPgForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
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
  return getDb()
    .select()
    .from(crewCategories)
    .orderBy(asc(crewCategories.name));
}

export async function listEndorsementTypes(
  ctx: AccessContext,
): Promise<EndorsementTypeRow[]> {
  assertAuthenticatedAccess(ctx);
  return getDb()
    .select()
    .from(endorsementTypes)
    .orderBy(asc(endorsementTypes.name));
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
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.vesselId) {
    conditions.push(eq(crewMembers.vesselId, filters.vesselId));
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
  const db = getDb();
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
    const row = inserted[0];
    if (!row) throw new Error("Crew member insert did not return a row");
    return row;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new CrewConflictError(
        "Vessel or category reference is invalid.",
      );
    }
    logError("CREW_MEMBER_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateCrewMember(
  ctx: AccessContext,
  id: string,
  input: CrewMemberUpdateInput,
): Promise<CrewMemberRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const existing = await db
    .select({ id: crewMembers.id })
    .from(crewMembers)
    .where(eq(crewMembers.id, id))
    .limit(1);
  if (!existing[0]) throw new CrewMemberNotFoundError(id);

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

  try {
    const updated = await db
      .update(crewMembers)
      .set(patch)
      .where(eq(crewMembers.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new CrewMemberNotFoundError(id);
    return row;
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
}

/** Hard-delete — blocked while certificates remain (RESTRICT). */
export async function deleteCrewMember(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
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
}
