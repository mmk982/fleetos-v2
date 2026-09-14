/**
 * Server Actions for Users & Roles — Admin-only (`PROJECT_PLAN.md` §7a).
 */
"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import { userRoleEnum } from "@/db/schema";
import { z } from "zod";
import {
  changeUserPassword,
  createUser,
  setUserActive,
  updateUser,
  UserConflictError,
  UserNotFoundError,
} from "./users.controller";

const usersPath = "/dashboard/settings/users";

export type UsersActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function readFormString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) return undefined;
  return String(v);
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
  role: z.enum(userRoleEnum),
  vesselId: z.string().uuid().optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().max(320).optional(),
  role: z.enum(userRoleEnum).optional(),
  vesselId: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
});

export async function createUserAction(
  _prev: UsersActionState | undefined,
  formData: FormData,
): Promise<UsersActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const vesselRaw = readFormString(formData, "vesselId");
  const parsed = createSchema.safeParse({
    name: readFormString(formData, "name") ?? "",
    email: readFormString(formData, "email") ?? "",
    password: readFormString(formData, "password") ?? "",
    role: readFormString(formData, "role") ?? "",
    vesselId: vesselRaw === "" || vesselRaw === undefined ? null : vesselRaw,
  });
  if (!parsed.success) {
    return { ok: false, message: "Please fix the highlighted fields." };
  }
  try {
    await createUser(access, parsed.data);
    revalidatePath(usersPath);
    return { ok: true, message: "User created." };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UserConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateUserAction(
  _prev: UsersActionState | undefined,
  formData: FormData,
): Promise<UsersActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const id = readFormString(formData, "id");
  if (!id) return { ok: false, message: "Missing user id." };
  const vesselRaw = readFormString(formData, "vesselId");
  const parsed = updateSchema.safeParse({
    name: readFormString(formData, "name"),
    email: readFormString(formData, "email"),
    role: readFormString(formData, "role"),
    vesselId: vesselRaw,
  });
  if (!parsed.success) {
    return { ok: false, message: "Please fix the highlighted fields." };
  }
  const vesselId =
    parsed.data.vesselId === "" || parsed.data.vesselId === undefined
      ? null
      : parsed.data.vesselId;
  try {
    await updateUser(access, id, { ...parsed.data, vesselId });
    revalidatePath(usersPath);
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (
      error instanceof ForbiddenError ||
      error instanceof UserConflictError ||
      error instanceof UserNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function changeUserPasswordAction(
  _prev: UsersActionState | undefined,
  formData: FormData,
): Promise<UsersActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const id = readFormString(formData, "id");
  const password = readFormString(formData, "password") ?? "";
  if (!id) return { ok: false, message: "Missing user id." };
  try {
    await changeUserPassword(access, id, password);
    revalidatePath(usersPath);
    return { ok: true, message: "Password updated." };
  } catch (error) {
    if (
      error instanceof ForbiddenError ||
      error instanceof UserConflictError ||
      error instanceof UserNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function setUserActiveAction(
  formData: FormData,
): Promise<UsersActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const id = readFormString(formData, "id");
  const active = readFormString(formData, "isActive") === "true";
  if (!id) return { ok: false, message: "Missing user id." };
  try {
    await setUserActive(access, id, active);
    revalidatePath(usersPath);
    return {
      ok: true,
      message: active ? "User activated." : "User deactivated.",
    };
  } catch (error) {
    if (
      error instanceof ForbiddenError ||
      error instanceof UserConflictError ||
      error instanceof UserNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
