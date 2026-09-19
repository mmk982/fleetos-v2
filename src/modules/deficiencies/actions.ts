/**
 * Server Actions for Deficiencies — form boundary + status transitions.
 *
 * Every action: {@link assertSameOriginMutation} →
 * {@link requireSession}(`touch: true`) → {@link toAccessContext} into the
 * controller (Phase 3 defense stack).
 *
 * Spec: PROJECT_PLAN.md §2.
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
  closeDeficiency,
  createDeficiency,
  createDeficiencySeverityLevel,
  createDeficiencySource,
  deleteDeficiency,
  deleteDeficiencyAttachment,
  deleteDeficiencySeverityLevel,
  deleteDeficiencySource,
  DeficiencyConflictError,
  DeficiencyNotFoundError,
  DeficiencySeverityLevelNotFoundError,
  DeficiencySourceNotFoundError,
  reopenDeficiency,
  setMonitoringDeficiency,
  startProgressDeficiency,
  updateDeficiency,
  updateDeficiencySeverityLevel,
  updateDeficiencySource,
  uploadDeficiencyAttachment,
} from "./deficiency.controller";
import {
  deficiencyCreateSchema,
  deficiencyUpdateSchema,
} from "./validation";
import { z } from "zod";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const deficienciesPath = "/dashboard/deficiencies";

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

export type DeficiencyActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createDeficiencyAction(
  _prev: DeficiencyActionState | undefined,
  formData: FormData,
): Promise<DeficiencyActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId") ?? "",
    title: readFormString(formData, "title") ?? "",
    sourceId: readFormString(formData, "sourceId") ?? "",
    status: readFormString(formData, "status"),
    deficiencyNumber: readFormString(formData, "deficiencyNumber"),
    category: readFormString(formData, "category"),
    description: readFormString(formData, "description"),
    reference: readFormString(formData, "reference"),
    identifiedDate: readFormString(formData, "identifiedDate"),
    dueDate: readFormString(formData, "dueDate"),
    closedDate: readFormString(formData, "closedDate"),
    correctiveAction: readFormString(formData, "correctiveAction"),
    responsiblePerson: readFormString(formData, "responsiblePerson"),
    notes: readFormString(formData, "notes"),
    pscInspectionId: readFormString(formData, "pscInspectionId"),
  };

  const parsed = deficiencyCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createDeficiency(access, parsed.data);
    revalidatePath(deficienciesPath);
    redirect(`${deficienciesPath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof DeficiencyConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateDeficiencyAction(
  id: string,
  _prev: DeficiencyActionState | undefined,
  formData: FormData,
): Promise<DeficiencyActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const keys = [
    "vesselId",
    "title",
    "sourceId",
    "status",
    "deficiencyNumber",
    "category",
    "description",
    "reference",
    "identifiedDate",
    "dueDate",
    "closedDate",
    "correctiveAction",
    "responsiblePerson",
    "notes",
    "pscInspectionId",
  ] as const;

  const raw: Record<string, string | undefined> = {};
  for (const key of keys) {
    const v = readFormString(formData, key);
    if (v !== undefined) raw[key] = v;
  }

  const parsed = deficiencyUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateDeficiency(access, id, parsed.data);
    revalidatePath(deficienciesPath);
    revalidatePath(`${deficienciesPath}/${id}`);
    revalidatePath(`${deficienciesPath}/${id}/edit`);
    redirect(`${deficienciesPath}/${id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof DeficiencyNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof DeficiencyConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteDeficiencyFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing deficiency id");
  }
  await deleteDeficiency(access, id);
  revalidatePath(deficienciesPath);
  redirect(deficienciesPath);
}

async function runStatusTransition(
  id: string,
  fn: (
    ctx: ReturnType<typeof toAccessContext>,
    id: string,
  ) => Promise<unknown>,
): Promise<DeficiencyActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  try {
    await fn(access, id);
    revalidatePath(deficienciesPath);
    revalidatePath(`${deficienciesPath}/${id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof DeficiencyNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function closeDeficiencyAction(
  id: string,
): Promise<DeficiencyActionState> {
  return runStatusTransition(id, closeDeficiency);
}

export async function reopenDeficiencyAction(
  id: string,
): Promise<DeficiencyActionState> {
  return runStatusTransition(id, reopenDeficiency);
}

export async function startProgressDeficiencyAction(
  id: string,
): Promise<DeficiencyActionState> {
  return runStatusTransition(id, startProgressDeficiency);
}

export async function setMonitoringDeficiencyAction(
  id: string,
): Promise<DeficiencyActionState> {
  return runStatusTransition(id, setMonitoringDeficiency);
}

/** FormData wrappers for detail-page `<form action={...}>` buttons. */
export async function closeDeficiencyFormAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const result = await closeDeficiencyAction(id);
  if (!result.ok) throw new Error(result.message);
}

export async function reopenDeficiencyFormAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const result = await reopenDeficiencyAction(id);
  if (!result.ok) throw new Error(result.message);
}

export async function startProgressDeficiencyFormAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const result = await startProgressDeficiencyAction(id);
  if (!result.ok) throw new Error(result.message);
}

export async function setMonitoringDeficiencyFormAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const result = await setMonitoringDeficiencyAction(id);
  if (!result.ok) throw new Error(result.message);
}

export async function uploadDeficiencyAttachmentAction(
  _prev: DeficiencyActionState | undefined,
  formData: FormData,
): Promise<DeficiencyActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const deficiencyId = readFormString(formData, "deficiencyId");
  if (!deficiencyId) {
    return { ok: false, message: "Missing deficiency id." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadDeficiencyAttachment(access, deficiencyId, {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      bytes,
    });
    revalidatePath(`${deficienciesPath}/${deficiencyId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof DeficiencyNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteDeficiencyAttachmentAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const id = formData.get("id");
  const deficiencyId = formData.get("deficiencyId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing attachment id");
  }
  try {
    await deleteDeficiencyAttachment(access, id);
  } catch (error) {
    if (!(error instanceof AttachmentNotFoundError)) throw error;
  }
  if (typeof deficiencyId === "string" && deficiencyId.length > 0) {
    revalidatePath(`${deficienciesPath}/${deficiencyId}`);
  }
}

const systemListsPath = "/dashboard/settings/system-lists";
const nameOnlySchema = z.object({ name: z.string().trim().min(1).max(200) });

export type SystemListActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createDeficiencySeverityLevelAction(
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
    await createDeficiencySeverityLevel(access, parsed.data);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Added." };
  } catch (error) {
    if (error instanceof DeficiencyConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateDeficiencySeverityLevelAction(
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
    await updateDeficiencySeverityLevel(access, id, parsed.data);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (
      error instanceof DeficiencyConflictError ||
      error instanceof DeficiencySeverityLevelNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteDeficiencySeverityLevelFormAction(
  formData: FormData,
): Promise<SystemListActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const id = readFormString(formData, "id");
  if (!id) return { ok: false, message: "Missing id." };
  try {
    await deleteDeficiencySeverityLevel(access, id);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Deleted." };
  } catch (error) {
    if (
      error instanceof DeficiencyConflictError ||
      error instanceof DeficiencySeverityLevelNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function createDeficiencySourceAction(
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
    await createDeficiencySource(access, parsed.data);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Added." };
  } catch (error) {
    if (error instanceof DeficiencyConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateDeficiencySourceAction(
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
    await updateDeficiencySource(access, id, parsed.data);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (
      error instanceof DeficiencyConflictError ||
      error instanceof DeficiencySourceNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteDeficiencySourceFormAction(
  formData: FormData,
): Promise<SystemListActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const id = readFormString(formData, "id");
  if (!id) return { ok: false, message: "Missing id." };
  try {
    await deleteDeficiencySource(access, id);
    revalidatePath(systemListsPath);
    return { ok: true, message: "Deleted." };
  } catch (error) {
    if (
      error instanceof DeficiencyConflictError ||
      error instanceof DeficiencySourceNotFoundError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
