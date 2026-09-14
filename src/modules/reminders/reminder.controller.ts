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
  type AccessContext,
} from "@/lib/auth/access";
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
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.vesselId) {
    conditions.push(eq(reminders.vesselId, filters.vesselId));
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
    const row = inserted[0];
    if (!row) throw new Error("Reminder insert did not return a row");
    return row;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new ReminderConflictError("Vessel reference is invalid.");
    }
    logError("REMINDER_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateReminder(
  ctx: AccessContext,
  id: string,
  input: ReminderUpdateInput,
): Promise<ReminderRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const existing = await db
    .select({ id: reminders.id })
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1);
  if (!existing[0]) throw new ReminderNotFoundError(id);

  const patch: Partial<typeof reminders.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.type !== undefined) patch.type = input.type;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.reminderDate !== undefined) patch.reminderDate = input.reminderDate;
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.relatedItemKind !== undefined) {
    patch.relatedItemKind = input.relatedItemKind;
  }
  if (input.relatedItemId !== undefined) {
    patch.relatedItemId = input.relatedItemId;
  }
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.status !== undefined) patch.status = input.status;

  try {
    const updated = await db
      .update(reminders)
      .set(patch)
      .where(eq(reminders.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new ReminderNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof ReminderNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new ReminderConflictError("Vessel reference is invalid.");
    }
    logError("REMINDER_UPDATE_FAILED", { error, reminderId: id });
    throw error;
  }
}

export async function deleteReminder(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
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
