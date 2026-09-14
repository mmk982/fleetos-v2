/**
 * Monthly form requirements data-access (`PROJECT_PLAN.md` §10).
 *
 * Defines which ISM templates are required per vessel (and at what
 * frequency). Checklist generation reads active rows from this table.
 */
import "server-only";

import { and, asc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  ismTemplates,
  monthlyFormRequirements,
  vessels,
  type MonthlyFormRequirementRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { logError } from "@/lib/logging";
import type { MonthlyFormRequirementListItem } from "./monthlyForm.model";
import type {
  MonthlyFormRequirementCreateInput,
  MonthlyFormRequirementUpdateInput,
} from "./validation";

export class MonthlyFormRequirementNotFoundError extends Error {
  readonly code = "MONTHLY_FORM_REQUIREMENT_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Monthly form requirement not found: ${id}`);
    this.name = "MonthlyFormRequirementNotFoundError";
  }
}

export class MonthlyFormRequirementConflictError extends Error {
  readonly code = "MONTHLY_FORM_REQUIREMENT_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "MonthlyFormRequirementConflictError";
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

export type MonthlyFormRequirementFilters = {
  vesselId?: string;
};

export async function listMonthlyFormRequirements(
  ctx: AccessContext,
  filters: MonthlyFormRequirementFilters = {},
): Promise<MonthlyFormRequirementListItem[]> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.vesselId) {
    conditions.push(eq(monthlyFormRequirements.vesselId, filters.vesselId));
  }

  const rows = await db
    .select({
      id: monthlyFormRequirements.id,
      vesselId: monthlyFormRequirements.vesselId,
      vesselName: vessels.name,
      ismTemplateId: monthlyFormRequirements.ismTemplateId,
      templateName: ismTemplates.formName,
      formCode: ismTemplates.formCode,
      frequency: monthlyFormRequirements.frequency,
      activeStatus: monthlyFormRequirements.activeStatus,
      createdAt: monthlyFormRequirements.createdAt,
      updatedAt: monthlyFormRequirements.updatedAt,
    })
    .from(monthlyFormRequirements)
    .innerJoin(vessels, eq(monthlyFormRequirements.vesselId, vessels.id))
    .innerJoin(
      ismTemplates,
      eq(monthlyFormRequirements.ismTemplateId, ismTemplates.id),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(vessels.name), asc(ismTemplates.formCode));

  return rows;
}

export async function getMonthlyFormRequirementById(
  ctx: AccessContext,
  id: string,
): Promise<MonthlyFormRequirementListItem | undefined> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const rows = await db
    .select({
      id: monthlyFormRequirements.id,
      vesselId: monthlyFormRequirements.vesselId,
      vesselName: vessels.name,
      ismTemplateId: monthlyFormRequirements.ismTemplateId,
      templateName: ismTemplates.formName,
      formCode: ismTemplates.formCode,
      frequency: monthlyFormRequirements.frequency,
      activeStatus: monthlyFormRequirements.activeStatus,
      createdAt: monthlyFormRequirements.createdAt,
      updatedAt: monthlyFormRequirements.updatedAt,
    })
    .from(monthlyFormRequirements)
    .innerJoin(vessels, eq(monthlyFormRequirements.vesselId, vessels.id))
    .innerJoin(
      ismTemplates,
      eq(monthlyFormRequirements.ismTemplateId, ismTemplates.id),
    )
    .where(eq(monthlyFormRequirements.id, id))
    .limit(1);
  return rows[0];
}

export async function createMonthlyFormRequirement(
  ctx: AccessContext,
  input: MonthlyFormRequirementCreateInput,
): Promise<MonthlyFormRequirementRow> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  try {
    const inserted = await db
      .insert(monthlyFormRequirements)
      .values({
        vesselId: input.vesselId,
        ismTemplateId: input.ismTemplateId,
        frequency: input.frequency,
        activeStatus: input.activeStatus,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("Requirement insert did not return a row");
    return row;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new MonthlyFormRequirementConflictError(
        "A requirement for this vessel and template already exists.",
      );
    }
    if (isPgForeignKeyViolation(error)) {
      throw new MonthlyFormRequirementConflictError(
        "Vessel or ISM template reference is invalid.",
      );
    }
    logError("MONTHLY_FORM_REQUIREMENT_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateMonthlyFormRequirement(
  ctx: AccessContext,
  id: string,
  input: MonthlyFormRequirementUpdateInput,
): Promise<MonthlyFormRequirementRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const existing = await db
    .select({ id: monthlyFormRequirements.id })
    .from(monthlyFormRequirements)
    .where(eq(monthlyFormRequirements.id, id))
    .limit(1);
  if (!existing[0]) throw new MonthlyFormRequirementNotFoundError(id);

  const patch: Partial<typeof monthlyFormRequirements.$inferInsert> & {
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.ismTemplateId !== undefined) {
    patch.ismTemplateId = input.ismTemplateId;
  }
  if (input.frequency !== undefined) patch.frequency = input.frequency;
  if (input.activeStatus !== undefined) patch.activeStatus = input.activeStatus;

  try {
    const updated = await db
      .update(monthlyFormRequirements)
      .set(patch)
      .where(eq(monthlyFormRequirements.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new MonthlyFormRequirementNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof MonthlyFormRequirementNotFoundError) throw error;
    if (isPgUniqueViolation(error)) {
      throw new MonthlyFormRequirementConflictError(
        "A requirement for this vessel and template already exists.",
      );
    }
    if (isPgForeignKeyViolation(error)) {
      throw new MonthlyFormRequirementConflictError(
        "Vessel or ISM template reference is invalid.",
      );
    }
    logError("MONTHLY_FORM_REQUIREMENT_UPDATE_FAILED", {
      error,
      requirementId: id,
    });
    throw error;
  }
}

export async function deleteMonthlyFormRequirement(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  try {
    const deleted = await db
      .delete(monthlyFormRequirements)
      .where(eq(monthlyFormRequirements.id, id))
      .returning({ id: monthlyFormRequirements.id });
    if (deleted.length === 0) {
      throw new MonthlyFormRequirementNotFoundError(id);
    }
  } catch (error) {
    if (error instanceof MonthlyFormRequirementNotFoundError) throw error;
    logError("MONTHLY_FORM_REQUIREMENT_DELETE_FAILED", {
      error,
      requirementId: id,
    });
    throw error;
  }
}
