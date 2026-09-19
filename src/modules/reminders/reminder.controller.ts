/**
 * Reminders data-access (`PROJECT_PLAN.md` §12).
 *
 * User-set reminders — no attachments, no expiry engine. Related-item
 * kind/id are stored raw; never resolved/joined in this module.
 */
import "server-only";

import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  reminders,
  vessels,
  type ReminderPriority,
  type ReminderRow,
  type ReminderStatus,
  type ReminderType,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  assertVesselScope,
  ForbiddenError,
  requireScopedVesselId,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import { logError } from "@/lib/logging";
import type { ReminderListItem } from "./reminder.model";
import type { ReminderCreateInput, ReminderUpdateInput } from "./validation";

export type { ReminderListItem } from "./reminder.model";

export class ReminderNotFoundError extends Error {
  readonly code = "REMINDER_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Reminder not found: ${id}`);
    this.name = "ReminderNotFoundError";
  }
}

export class ReminderConflictError extends Error {
  readonly code = "REMINDER_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "ReminderConflictError";
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

export type ReminderListFilters = {
  vesselId?: string;
  type?: ReminderType;
  priority?: ReminderPriority;
  status?: ReminderStatus;
};

export async function listReminders(
  ctx: AccessContext,
  filters: ReminderListFilters = {},
): Promise<ReminderListItem[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "reminders", "read");
  const scopedVesselId = requireScopedVesselId(ctx) ?? filters.vesselId;
  const db = getDb();
  const conditions: SQL[] = [];
  if (scopedVesselId) {
    conditions.push(eq(reminders.vesselId, scopedVesselId));
  }
  if (filters.type) {
    conditions.push(eq(reminders.type, filters.type));
  }
  if (filters.priority) {
    conditions.push(eq(reminders.priority, filters.priority));
  }
  if (filters.status) {
    conditions.push(eq(reminders.status, filters.status));
  }

  const rows = await db
    .select({
      reminder: reminders,
      vesselName: vessels.name,
    })
    .from(reminders)
    .leftJoin(vessels, eq(reminders.vesselId, vessels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(reminders.reminderDate), desc(reminders.createdAt));

  return rows.map((r) => ({
    ...r.reminder,
    vesselName: r.vesselName ?? null,
  }));
}

export async function getReminderById(
  ctx: AccessContext,
  id: string,
): Promise<ReminderListItem | undefined> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "reminders", "read");
  const rows = await getDb()
    .select({
      reminder: reminders,
      vesselName: vessels.name,
    })
    .from(reminders)
    .leftJoin(vessels, eq(reminders.vesselId, vessels.id))
    .where(eq(reminders.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  assertVesselScope(ctx, row.reminder.vesselId);
  return {
    ...row.reminder,
    vesselName: row.vesselName ?? null,
  };
}

export async function createReminder(
  ctx: AccessContext,
  input: ReminderCreateInput,
): Promise<ReminderRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "reminders", "write");
  assertVesselScope(ctx, input.vesselId ?? null);
  let row: ReminderRow;
  try {
    const inserted = await getDb()
      .insert(reminders)
      .values({
        title: input.title,
        type: input.type,
        priority: input.priority,
        reminderDate: input.reminderDate,
        vesselId: input.vesselId ?? null,
        relatedItemKind: input.relatedItemKind ?? null,
        relatedItemId: input.relatedItemId ?? null,
        notes: input.notes ?? null,
        status: "pending",
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) throw new Error("Reminder insert did not return a row");
    row = insertedRow;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new ReminderConflictError("Vessel reference is invalid.");
    }
    logError("REMINDER_CREATE_FAILED", { error });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "reminder",
    recordId: row.id,
    description: `Added reminder: ${row.title}`,
  });
  return row;
}

export async function updateReminder(
  ctx: AccessContext,
  id: string,
  input: ReminderUpdateInput,
): Promise<ReminderRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "reminders", "write");
  const db = getDb();

  const existing = await db
    .select({ id: reminders.id, vesselId: reminders.vesselId })
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1);
  if (!existing[0]) throw new ReminderNotFoundError(id);
  assertVesselScope(ctx, existing[0].vesselId);

  const patch: Partial<typeof reminders.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.type !== undefined) patch.type = input.type;
  if (input.priority !== undefined) patch.priority = input.priority;
  // isoDateField allows null (clear), but reminder_date is NOT NULL — ignore null.
  if (input.reminderDate != null) patch.reminderDate = input.reminderDate;
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.relatedItemKind !== undefined) {
    patch.relatedItemKind = input.relatedItemKind;
  }
  if (input.relatedItemId !== undefined) {
    patch.relatedItemId = input.relatedItemId;
  }
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.status !== undefined) patch.status = input.status;

  let row: ReminderRow;
  try {
    const updated = await db
      .update(reminders)
      .set(patch)
      .where(eq(reminders.id, id))
      .returning();
    const updatedRow = updated[0];
    if (!updatedRow) throw new ReminderNotFoundError(id);
    row = updatedRow;
  } catch (error) {
    if (
      error instanceof ReminderNotFoundError ||
      error instanceof ForbiddenError
    ) {
      throw error;
    }
    if (isPgForeignKeyViolation(error)) {
      throw new ReminderConflictError("Vessel reference is invalid.");
    }
    logError("REMINDER_UPDATE_FAILED", { error, reminderId: id });
    throw error;
  }

  let actionType = "updated";
  let description = `Updated reminder: ${row.title}`;
  if (input.status === "dismissed") {
    actionType = "dismissed";
    description = `Dismissed reminder: ${row.title}`;
  } else if (input.status === "done") {
    actionType = "completed";
    description = `Completed reminder: ${row.title}`;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType,
    moduleName: "reminder",
    recordId: row.id,
    description,
  });
  return row;
}

export async function deleteReminder(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "reminders", "write");
  const existing = await getDb()
    .select({ title: reminders.title, vesselId: reminders.vesselId })
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1);
  if (!existing[0]) throw new ReminderNotFoundError(id);
  assertVesselScope(ctx, existing[0].vesselId);
  const title = existing[0].title;
  try {
    const deleted = await getDb()
      .delete(reminders)
      .where(eq(reminders.id, id))
      .returning({ id: reminders.id });
    if (deleted.length === 0) throw new ReminderNotFoundError(id);
  } catch (error) {
    if (error instanceof ReminderNotFoundError) throw error;
    logError("REMINDER_DELETE_FAILED", { error, reminderId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "reminder",
    recordId: id,
    description: title ? `Deleted reminder: ${title}` : "Deleted reminder",
  });
}

export async function dismissReminder(
  ctx: AccessContext,
  id: string,
): Promise<ReminderRow> {
  return updateReminder(ctx, id, { status: "dismissed" });
}

export async function completeReminder(
  ctx: AccessContext,
  id: string,
): Promise<ReminderRow> {
  return updateReminder(ctx, id, { status: "done" });
}
