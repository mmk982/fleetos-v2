/**
 * Server Actions for Drawings — form boundary + attachments.
 *
 * Every action: {@link assertSameOriginMutation} →
 * {@link requireSession}(`touch: true`) → {@link toAccessContext} into the
 * controller (Phase 3 defense stack).
 *
 * Spec: PROJECT_PLAN.md §11.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import {
  AttachmentNotFoundError,
  AttachmentValidationError,
  createDrawing,
  createDrawingCategory,
  deleteDrawing,
  deleteDrawingAttachment,
  deleteDrawingCategory,
  DrawingCategoryNotFoundError,
  DrawingConflictError,
  DrawingNotFoundError,
  updateDrawing,
  updateDrawingCategory,
  uploadDrawingAttachment,
} from "./drawing.controller";
import { drawingCreateSchema, drawingUpdateSchema } from "./validation";
import { z } from "zod";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const drawingsPath = "/dashboard/drawings";

function readFormString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) return undefined;
  return String(v);
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

export type DrawingActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createDrawingAction(
  _prev: DrawingActionState | undefined,
  formData: FormData,
): Promise<DrawingActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId") ?? "",
    categoryId: readFormString(formData, "categoryId") ?? "",
    drawingName: readFormString(formData, "drawingName") ?? "",
    drawingNumber: readFormString(formData, "drawingNumber"),
    revision: readFormString(formData, "revision"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = drawingCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createDrawing(access, parsed.data);
    revalidatePath(drawingsPath);
    redirect(`${drawingsPath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof DrawingConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateDrawingAction(
  id: string,
  _prev: DrawingActionState | undefined,
  formData: FormData,
): Promise<DrawingActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId"),
    categoryId: readFormString(formData, "categoryId"),
    drawingName: readFormString(formData, "drawingName"),
    drawingNumber: readFormString(formData, "drawingNumber"),
    revision: readFormString(formData, "revision"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = drawingUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateDrawing(access, id, parsed.data);
    revalidatePath(drawingsPath);
    revalidatePath(`${drawingsPath}/${id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof DrawingNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof DrawingConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteDrawingFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing drawing id");
  }
  await deleteDrawing(access, id);
  revalidatePath(drawingsPath);
  redirect(drawingsPath);
}

export async function uploadDrawingAttachmentAction(
  _prev: DrawingActionState | undefined,
  formData: FormData,
): Promise<DrawingActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const drawingId = readFormString(formData, "drawingId");
  if (!drawingId) {
    return { ok: false, message: "Missing drawing id." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadDrawingAttachment(access, drawingId, {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      bytes,
    });
    revalidatePath(`${drawingsPath}/${drawingId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof DrawingNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteDrawingAttachmentAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const id = formData.get("id");
  const drawingId = formData.get("drawingId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing attachment id");
  }
  try {
    await deleteDrawingAttachment(access, id);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    throw error;
  }
  if (typeof drawingId === "string" && drawingId.length > 0) {
    revalidatePath(`${drawingsPath}/${drawingId}`);
  }
}

const systemListsPath = "/dashboard/settings/system-lists";
const nameOnlySchema = z.object({ name: z.string().trim().min(1).max(200) });

export type SystemListActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createDrawingCategoryAction(
  _prev: SystemListActionState | undefined,
  formData: FormData,
): Promise<SystemListActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const parsed = nameOnlySchema.safeParse({
    name: readFormString(formData, "name") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: "Name is required." };
  }
  try {
    await createDrawingCategory(access, parsed.data);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Added." };
  } catch (error) {
    if (error instanceof DrawingConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateDrawingCategoryAction(
  _prev: SystemListActionState | undefined,
  formData: FormData,
): Promise<SystemListActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const id = readFormString(formData, "id") ?? "";
  const parsed = nameOnlySchema.safeParse({
    name: readFormString(formData, "name") ?? "",
  });
  if (!parsed.success || !id) {
    return { ok: false, message: "Please fix the highlighted fields." };
  }
  try {
    await updateDrawingCategory(access, id, parsed.data);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (
      error instanceof DrawingConflictError ||
      error instanceof DrawingCategoryNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteDrawingCategoryFormAction(
  formData: FormData,
): Promise<SystemListActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const id = readFormString(formData, "id");
  if (!id) return { ok: false, message: "Missing id." };
  try {
    await deleteDrawingCategory(access, id);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Deleted." };
  } catch (error) {
    if (
      error instanceof DrawingConflictError ||
      error instanceof DrawingCategoryNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
