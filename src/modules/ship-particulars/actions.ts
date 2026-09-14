/**
 * Server Actions for Ship Particulars + vessel notes.
 *
 * Every action: assertSameOriginMutation → requireSession(touch) →
 * toAccessContext. Notes have no UI in this pass (API/actions only).
 *
 * Spec: PROJECT_PLAN.md §13.
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
  createParticulars,
  deleteParticulars,
  deleteParticularsAttachment,
  getParticularsById,
  ParticularsConflictError,
  ParticularsNotFoundError,
  updateParticulars,
  uploadParticularsAttachment,
} from "./particulars.controller";
import {
  createVesselNote,
  deleteVesselNote,
  VesselNoteConflictError,
  VesselNoteNotFoundError,
} from "./vessel-notes.controller";
import {
  particularsCreateSchema,
  particularsUpdateSchema,
  vesselNoteCreateSchema,
} from "./validation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const particularsPath = "/dashboard/particulars";

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

function readParticularsFields(formData: FormData) {
  return {
    classSociety: readFormString(formData, "classSociety"),
    portOfRegistry: readFormString(formData, "portOfRegistry"),
    owner: readFormString(formData, "owner"),
    manager: readFormString(formData, "manager"),
    deadweightTonnage: readFormString(formData, "deadweightTonnage"),
    netRegisteredTonnage: readFormString(formData, "netRegisteredTonnage"),
    lengthOverall: readFormString(formData, "lengthOverall"),
    breadth: readFormString(formData, "breadth"),
    depth: readFormString(formData, "depth"),
    draft: readFormString(formData, "draft"),
    mainEngine: readFormString(formData, "mainEngine"),
    auxEngines: readFormString(formData, "auxEngines"),
    cargoCapacity: readFormString(formData, "cargoCapacity"),
    ballastCapacity: readFormString(formData, "ballastCapacity"),
    fuelOilCapacity: readFormString(formData, "fuelOilCapacity"),
    freshWaterCapacity: readFormString(formData, "freshWaterCapacity"),
    effectiveDate: readFormString(formData, "effectiveDate"),
    notes: readFormString(formData, "notes"),
    isCurrent: readFormString(formData, "isCurrent"),
  };
}

export type ParticularsActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createParticularsAction(
  _prev: ParticularsActionState | undefined,
  formData: FormData,
): Promise<ParticularsActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const parsed = particularsCreateSchema.safeParse({
    vesselId: readFormString(formData, "vesselId") ?? "",
    ...readParticularsFields(formData),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createParticulars(access, parsed.data);
    revalidatePath(particularsPath);
    revalidatePath(`${particularsPath}/${row.vesselId}`);
    redirect(`${particularsPath}/${row.vesselId}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof ParticularsConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateParticularsAction(
  id: string,
  _prev: ParticularsActionState | undefined,
  formData: FormData,
): Promise<ParticularsActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const parsed = particularsUpdateSchema.safeParse({
    vesselId: emptyToUndefined(readFormString(formData, "vesselId")),
    ...readParticularsFields(formData),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await updateParticulars(access, id, parsed.data);
    revalidatePath(particularsPath);
    revalidatePath(`${particularsPath}/${row.vesselId}`);
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (error instanceof ParticularsNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof ParticularsConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteParticularsFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing particulars id");
  }
  const existing = await getParticularsById(access, id);
  const vesselId = existing?.vesselId;
  await deleteParticulars(access, id);
  revalidatePath(particularsPath);
  if (vesselId) {
    revalidatePath(`${particularsPath}/${vesselId}`);
    redirect(`${particularsPath}/${vesselId}`);
  }
  redirect(particularsPath);
}

export async function uploadParticularsAttachmentAction(
  _prev: ParticularsActionState | undefined,
  formData: FormData,
): Promise<ParticularsActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const particularsId = readFormString(formData, "particularsId");
  const vesselId = readFormString(formData, "vesselId");
  if (!particularsId) {
    return { ok: false, message: "Missing particulars id." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadParticularsAttachment(access, particularsId, {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      bytes,
    });
    if (vesselId) revalidatePath(`${particularsPath}/${vesselId}`);
    return { ok: true, message: "Uploaded." };
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof ParticularsNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteParticularsAttachmentAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const id = formData.get("id");
  const vesselId = formData.get("vesselId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing attachment id");
  }
  try {
    await deleteParticularsAttachment(access, id);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    throw error;
  }
  if (typeof vesselId === "string" && vesselId.length > 0) {
    revalidatePath(`${particularsPath}/${vesselId}`);
  }
}

export async function createVesselNoteAction(
  _prev: ParticularsActionState | undefined,
  formData: FormData,
): Promise<ParticularsActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const parsed = vesselNoteCreateSchema.safeParse({
    vesselId: readFormString(formData, "vesselId") ?? "",
    body: readFormString(formData, "body") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await createVesselNote(access, parsed.data.vesselId, parsed.data.body);
    return { ok: true, message: "Note added." };
  } catch (error) {
    if (error instanceof VesselNoteConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteVesselNoteFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing note id");
  }
  try {
    await deleteVesselNote(access, id);
  } catch (error) {
    if (error instanceof VesselNoteNotFoundError) throw error;
    throw error;
  }
}
