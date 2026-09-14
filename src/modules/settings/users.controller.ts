/**
 * Users & Roles admin CRUD (`PROJECT_PLAN.md` §7a).
 * Admin-only — narrow gate, not the full Phase 6 WRITE_ROLES table.
 */
import "server-only";

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  users,
  vessels,
  type UserRole,
  type UserRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  ForbiddenError,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import { hashPassword } from "@/lib/auth/password";
import { logError } from "@/lib/logging";
import { roleRequiresVessel, type UserListItem } from "./users.model";

export { roleRequiresVessel } from "./users.model";
export type { UserListItem } from "./users.model";

export class UserNotFoundError extends Error {
  readonly code = "USER_NOT_FOUND" as const;
  constructor(id: string) {
    super(`User not found: ${id}`);
    this.name = "UserNotFoundError";
  }
}

export class UserConflictError extends Error {
  readonly code = "USER_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "UserConflictError";
  }
}

function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

function isPgForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

/** Users & Roles is Admin-only (independent of the broader Phase 6 table). */
export function assertAdminAccess(ctx: AccessContext): void {
  assertAuthenticatedAccess(ctx);
  if (ctx.role !== "admin") {
    throw new ForbiddenError("Admin role required for Users & Roles.");
  }
}

export async function listUsers(ctx: AccessContext): Promise<UserListItem[]> {
  assertAdminAccess(ctx);
  const rows = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      vesselId: users.vesselId,
      vesselName: vessels.name,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(vessels, eq(users.vesselId, vessels.id))
    .orderBy(asc(users.name));
  return rows.map((r) => ({
    ...r,
    role: r.role as UserRole,
  }));
}

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  vesselId?: string | null;
};

export async function createUser(
  ctx: AccessContext,
  input: CreateUserInput,
): Promise<UserRow> {
  assertAdminAccess(ctx);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new UserConflictError("Name is required.");
  if (!email) throw new UserConflictError("Email is required.");
  if (input.password.length < 8) {
    throw new UserConflictError("Password must be at least 8 characters.");
  }
  if (roleRequiresVessel(input.role) && !input.vesselId) {
    throw new UserConflictError(
      "Vessel is required for Management User and Vessel User.",
    );
  }
  const vesselId = roleRequiresVessel(input.role)
    ? (input.vesselId ?? null)
    : null;

  let row: UserRow;
  try {
    const passwordHash = await hashPassword(input.password);
    const inserted = await getDb()
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        role: input.role,
        vesselId,
        isActive: true,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) throw new Error("User insert did not return a row");
    row = insertedRow;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new UserConflictError("A user with that email already exists.");
    }
    if (isPgForeignKeyViolation(error)) {
      throw new UserConflictError("Vessel reference is invalid.");
    }
    logError("USER_CREATE_FAILED", { error });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "user",
    recordId: row.id,
    description: `Added user: ${name}`,
  });
  return row;
}

export type UpdateUserInput = {
  name?: string;
  email?: string;
  role?: UserRole;
  vesselId?: string | null;
};

export async function updateUser(
  ctx: AccessContext,
  id: string,
  input: UpdateUserInput,
): Promise<UserRow> {
  assertAdminAccess(ctx);
  const db = getDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!existing[0]) throw new UserNotFoundError(id);

  const nextRole = input.role ?? (existing[0].role as UserRole);
  let vesselId =
    input.vesselId !== undefined ? input.vesselId : existing[0].vesselId;
  if (!roleRequiresVessel(nextRole)) {
    vesselId = null;
  } else if (!vesselId) {
    throw new UserConflictError(
      "Vessel is required for Management User and Vessel User.",
    );
  }

  const patch: Partial<typeof users.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new UserConflictError("Name is required.");
    patch.name = name;
  }
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new UserConflictError("Email is required.");
    patch.email = email;
  }
  if (input.role !== undefined) patch.role = input.role;
  patch.vesselId = vesselId;

  let row: UserRow;
  try {
    const updated = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();
    const updatedRow = updated[0];
    if (!updatedRow) throw new UserNotFoundError(id);
    row = updatedRow;
  } catch (error) {
    if (error instanceof UserNotFoundError) throw error;
    if (isPgUniqueViolation(error)) {
      throw new UserConflictError("A user with that email already exists.");
    }
    if (isPgForeignKeyViolation(error)) {
      throw new UserConflictError("Vessel reference is invalid.");
    }
    logError("USER_UPDATE_FAILED", { error, userId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "user",
    recordId: row.id,
    description: `Updated user: ${row.name}`,
  });
  return row;
}

export async function changeUserPassword(
  ctx: AccessContext,
  id: string,
  password: string,
): Promise<void> {
  assertAdminAccess(ctx);
  if (password.length < 8) {
    throw new UserConflictError("Password must be at least 8 characters.");
  }
  const db = getDb();
  const existing = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!existing[0]) throw new UserNotFoundError(id);

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id));

  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "user",
    recordId: id,
    description: `Changed password for user: ${existing[0].name}`,
  });
}

export async function setUserActive(
  ctx: AccessContext,
  id: string,
  isActive: boolean,
): Promise<UserRow> {
  assertAdminAccess(ctx);
  if (id === ctx.userId && !isActive) {
    throw new UserConflictError("You cannot deactivate your own account.");
  }
  const updated = await getDb()
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  const row = updated[0];
  if (!row) throw new UserNotFoundError(id);
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "user",
    recordId: row.id,
    description: isActive
      ? `Activated user: ${row.name}`
      : `Deactivated user: ${row.name}`,
  });
  return row;
}
