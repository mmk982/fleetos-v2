/**
 * Server Actions for Reminders (`PROJECT_PLAN.md` §12).
 *
 * Every action: assertSameOriginMutation → requireSession(touch) →
 * toAccessContext. Includes dismissReminderAction / completeReminderAction
 * by exact §12 names.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  dismissReminder,
  ReminderConflictError,
  ReminderNotFoundError,
  updateReminder,
} from "./reminder.controller";
import { reminderCreateSchema, reminderUpdateSchema } from "./validation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const remindersPath = "/dashboard/reminders";

function readFormString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) return undefined;
  return String(v);
}

function emptyToUndefined(v: string | undefined): string | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  return v;
}

function fieldErrorsFromZod(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const pathKey = issue.path[0];
    if (typeof pathKey === "string") {
      fieldErrors[pathKey] ??= [];
      fieldErrors[pathKey].push(issue.message);
    }
  }
  return fieldErrors;
}

export type ReminderActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createReminderAction(
  _prev: ReminderActionState | undefined,
  formData: FormData,
): Promise<ReminderActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const parsed = reminderCreateSchema.safeParse({
    title: readFormString(formData, "title") ?? "",
    type: readFormString(formData, "type") ?? "",
    priority: readFormString(formData, "priority") ?? "medium",
    reminderDate: readFormString(formData, "reminderDate") ?? "",
    vesselId: emptyToUndefined(readFormString(formData, "vesselId")),
    relatedItemKind: readFormString(formData, "relatedItemKind"),
    relatedItemId: emptyToUndefined(readFormString(formData, "relatedItemId")),
    notes: readFormString(formData, "notes"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createReminder(access, parsed.data);
    revalidatePath(remindersPath);
    redirect(`${remindersPath}/${row.id}/edit`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof ReminderConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateReminderAction(
  id: string,
  _prev: ReminderActionState | undefined,
  formData: FormData,
): Promise<ReminderActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const parsed = reminderUpdateSchema.safeParse({
    title: emptyToUndefined(readFormString(formData, "title")),
    type: emptyToUndefined(readFormString(formData, "type")),
    priority: emptyToUndefined(readFormString(formData, "priority")),
    reminderDate: readFormString(formData, "reminderDate"),
    // Empty select → null (fleet-wide); do not strip to undefined or clear is lost.
    vesselId: readFormString(formData, "vesselId") ?? "",
    relatedItemKind: readFormString(formData, "relatedItemKind"),
    relatedItemId: readFormString(formData, "relatedItemId") ?? "",
    notes: readFormString(formData, "notes"),
    status: emptyToUndefined(readFormString(formData, "status")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateReminder(access, id, parsed.data);
    revalidatePath(remindersPath);
    revalidatePath(`${remindersPath}/${id}/edit`);
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (error instanceof ReminderNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof ReminderConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteReminderFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing reminder id");
  }
  await deleteReminder(access, id);
  revalidatePath(remindersPath);
  redirect(remindersPath);
}

/** §12 exact name — sets status to dismissed. */
export async function dismissReminderAction(id: string): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  await dismissReminder(access, id);
  revalidatePath(remindersPath);
  revalidatePath(`${remindersPath}/${id}/edit`);
}

/** §12 exact name — sets status to done. */
export async function completeReminderAction(id: string): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  await completeReminder(access, id);
  revalidatePath(remindersPath);
  revalidatePath(`${remindersPath}/${id}/edit`);
}

/** Form-friendly wrappers for list-row quick actions. */
export async function dismissReminderFormAction(
  formData: FormData,
): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing reminder id");
  }
  await dismissReminderAction(id);
}

export async function completeReminderFormAction(
  formData: FormData,
): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing reminder id");
  }
  await completeReminderAction(id);
}
