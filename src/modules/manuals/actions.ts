/**
 * Server Actions for Manuals — create+first revision, revisions, set-current.
 *
 * Every action: {@link assertSameOriginMutation} →
 * {@link requireSession}(`touch: true`) → {@link toAccessContext} into the
 * controller (Phase 3 defense stack).
 *
 * Spec: PROJECT_PLAN.md §8.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import {
  addManualRevision,
  AttachmentValidationError,
  createManualWithFirstRevision,
  deleteManual,
  ManualConflictError,
  ManualNotFoundError,
  ManualRevisionNotFoundError,
  setCurrentRevision,
  updateManual,
} from "./manual.controller";
import {
  manualCreateSchema,
  manualRevisionCreateSchema,
  manualUpdateSchema,
} from "./validation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const manualsPath = "/dashboard/manuals";

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

export type ManualActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createManualAction(
  _prev: ManualActionState | undefined,
  formData: FormData,
): Promise<ManualActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId") ?? "",
    title: readFormString(formData, "title") ?? "",
    manualType: readFormString(formData, "manualType"),
    department: readFormString(formData, "department"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = manualCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file for the first revision." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const row = await createManualWithFirstRevision(
      access,
      parsed.data,
      {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        bytes,
      },
      {
        revisionNumber: readFormString(formData, "revisionNumber") ?? null,
        revisionDate: readFormString(formData, "revisionDate") ?? null,
      },
    );
    revalidatePath(manualsPath);
    redirect(`${manualsPath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof ManualConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateManualAction(
  id: string,
  _prev: ManualActionState | undefined,
  formData: FormData,
): Promise<ManualActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId"),
    title: readFormString(formData, "title"),
    manualType: readFormString(formData, "manualType"),
    department: readFormString(formData, "department"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = manualUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateManual(access, id, parsed.data);
    revalidatePath(manualsPath);
    revalidatePath(`${manualsPath}/${id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ManualNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof ManualConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteManualFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing manual id");
  }
  await deleteManual(access, id);
  revalidatePath(manualsPath);
  redirect(manualsPath);
}

export async function addManualRevisionAction(
  _prev: ManualActionState | undefined,
  formData: FormData,
): Promise<ManualActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const manualId = readFormString(formData, "manualId");
  if (!manualId) {
    return { ok: false, message: "Missing manual id." };
  }

  const parsed = manualRevisionCreateSchema.safeParse({
    manualId,
    revisionNumber: readFormString(formData, "revisionNumber"),
    revisionDate: readFormString(formData, "revisionDate"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await addManualRevision(
      access,
      manualId,
      {
        revisionNumber: parsed.data.revisionNumber,
        revisionDate: parsed.data.revisionDate,
      },
      {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        bytes,
      },
    );
    revalidatePath(`${manualsPath}/${manualId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof ManualNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function setCurrentRevisionFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const manualId = formData.get("manualId");
  const revisionId = formData.get("revisionId");
  if (typeof manualId !== "string" || manualId.length === 0) {
    throw new Error("Missing manual id");
  }
  if (typeof revisionId !== "string" || revisionId.length === 0) {
    throw new Error("Missing revision id");
  }

  try {
    await setCurrentRevision(access, manualId, revisionId);
  } catch (error) {
    if (error instanceof ManualRevisionNotFoundError) throw error;
    throw error;
  }
  revalidatePath(`${manualsPath}/${manualId}`);
}
