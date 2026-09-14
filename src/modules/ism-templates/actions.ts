/**
 * Server Actions for ISM Templates — form boundary + attachments.
 *
 * Every action: {@link assertSameOriginMutation} →
 * {@link requireSession}(`touch: true`) → {@link toAccessContext} into the
 * controller (Phase 3 defense stack).
 *
 * Spec: PROJECT_PLAN.md §9.
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
  createIsmTemplate,
  createIsmTemplateCategory,
  deleteIsmTemplate,
  deleteIsmTemplateAttachment,
  deleteIsmTemplateCategory,
  IsmTemplateCategoryNotFoundError,
  IsmTemplateConflictError,
  IsmTemplateNotFoundError,
  updateIsmTemplate,
  updateIsmTemplateCategory,
  uploadIsmTemplateAttachment,
} from "./ismTemplate.controller";
import {
  ismTemplateCreateSchema,
  ismTemplateUpdateSchema,
} from "./validation";
import { z } from "zod";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const templatesPath = "/dashboard/ism-templates";

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

export type IsmTemplateActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createIsmTemplateAction(
  _prev: IsmTemplateActionState | undefined,
  formData: FormData,
): Promise<IsmTemplateActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    formCode: readFormString(formData, "formCode") ?? "",
    formName: readFormString(formData, "formName") ?? "",
    categoryId: readFormString(formData, "categoryId") ?? "",
    revision: readFormString(formData, "revision"),
    status: readFormString(formData, "status"),
  };

  const parsed = ismTemplateCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createIsmTemplate(access, parsed.data);
    revalidatePath(templatesPath);
    redirect(`${templatesPath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof IsmTemplateConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateIsmTemplateAction(
  id: string,
  _prev: IsmTemplateActionState | undefined,
  formData: FormData,
): Promise<IsmTemplateActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    formCode: readFormString(formData, "formCode"),
    formName: readFormString(formData, "formName"),
    categoryId: readFormString(formData, "categoryId"),
    revision: readFormString(formData, "revision"),
    status: readFormString(formData, "status"),
  };

  const parsed = ismTemplateUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateIsmTemplate(access, id, parsed.data);
    revalidatePath(templatesPath);
    revalidatePath(`${templatesPath}/${id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof IsmTemplateNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof IsmTemplateConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteIsmTemplateFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing ISM template id");
  }
  await deleteIsmTemplate(access, id);
  revalidatePath(templatesPath);
  redirect(templatesPath);
}

export async function uploadIsmTemplateAttachmentAction(
  _prev: IsmTemplateActionState | undefined,
  formData: FormData,
): Promise<IsmTemplateActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const ismTemplateId = readFormString(formData, "ismTemplateId");
  if (!ismTemplateId) {
    return { ok: false, message: "Missing template id." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadIsmTemplateAttachment(access, ismTemplateId, {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      bytes,
    });
    revalidatePath(`${templatesPath}/${ismTemplateId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof IsmTemplateNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteIsmTemplateAttachmentAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const id = formData.get("id");
  const ismTemplateId = formData.get("ismTemplateId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing attachment id");
  }
  try {
    await deleteIsmTemplateAttachment(access, id);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    throw error;
  }
  if (typeof ismTemplateId === "string" && ismTemplateId.length > 0) {
    revalidatePath(`${templatesPath}/${ismTemplateId}`);
  }
}

const systemListsPath = "/dashboard/settings/system-lists";
const nameOnlySchema = z.object({ name: z.string().trim().min(1).max(200) });

export type SystemListActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createIsmTemplateCategoryAction(
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
    await createIsmTemplateCategory(access, parsed.data);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Added." };
  } catch (error) {
    if (error instanceof IsmTemplateConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateIsmTemplateCategoryAction(
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
    await updateIsmTemplateCategory(access, id, parsed.data);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (
      error instanceof IsmTemplateConflictError ||
      error instanceof IsmTemplateCategoryNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteIsmTemplateCategoryFormAction(
  formData: FormData,
): Promise<SystemListActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const id = readFormString(formData, "id");
  if (!id) return { ok: false, message: "Missing id." };
  try {
    await deleteIsmTemplateCategory(access, id);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Deleted." };
  } catch (error) {
    if (
      error instanceof IsmTemplateConflictError ||
      error instanceof IsmTemplateCategoryNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
