/**
 * Server Actions for Monthly Executed Forms + requirements.
 *
 * Every action: {@link assertSameOriginMutation} →
 * {@link requireSession}(`touch: true`) → {@link toAccessContext}.
 *
 * Spec: PROJECT_PLAN.md §10.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import {
  createMonthlyFormRequirement,
  deleteMonthlyFormRequirement,
  MonthlyFormRequirementConflictError,
  MonthlyFormRequirementNotFoundError,
  updateMonthlyFormRequirement,
} from "./monthly-form-requirement.controller";
import {
  AttachmentNotFoundError,
  AttachmentValidationError,
  createMonthlyForm,
  deleteMonthlyForm,
  deleteMonthlyFormAttachment,
  generateMonthlyChecklist,
  MonthlyFormConflictError,
  MonthlyFormNotFoundError,
  submitMonthlyForm,
} from "./monthlyForm.controller";
import {
  monthlyFormCreateSchema,
  monthlyFormGenerateSchema,
  monthlyFormRequirementCreateSchema,
  monthlyFormRequirementUpdateSchema,
  monthlyFormSubmitSchema,
} from "./validation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const formsPath = "/dashboard/monthly-forms";

function readFormString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) return undefined;
  return String(v);
}

function readFormBool(formData: FormData, key: string): boolean | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) return undefined;
  if (v === "true" || v === "on" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
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

export type MonthlyFormActionState =
  | { ok: true; message?: string; created?: number }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

// --- Requirements ---

export async function createMonthlyFormRequirementAction(
  _prev: MonthlyFormActionState | undefined,
  formData: FormData,
): Promise<MonthlyFormActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const activeRaw = readFormBool(formData, "activeStatus");
  const parsed = monthlyFormRequirementCreateSchema.safeParse({
    vesselId: readFormString(formData, "vesselId") ?? "",
    ismTemplateId: readFormString(formData, "ismTemplateId") ?? "",
    frequency: readFormString(formData, "frequency") ?? "monthly",
    activeStatus: activeRaw ?? true,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await createMonthlyFormRequirement(access, parsed.data);
    revalidatePath(formsPath);
    return { ok: true, message: "Requirement added." };
  } catch (error) {
    if (error instanceof MonthlyFormRequirementConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateMonthlyFormRequirementAction(
  id: string,
  _prev: MonthlyFormActionState | undefined,
  formData: FormData,
): Promise<MonthlyFormActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const parsed = monthlyFormRequirementUpdateSchema.safeParse({
    vesselId: emptyToUndefined(readFormString(formData, "vesselId")),
    ismTemplateId: emptyToUndefined(readFormString(formData, "ismTemplateId")),
    frequency: emptyToUndefined(readFormString(formData, "frequency")),
    activeStatus: readFormBool(formData, "activeStatus"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateMonthlyFormRequirement(access, id, parsed.data);
    revalidatePath(formsPath);
    return { ok: true, message: "Requirement updated." };
  } catch (error) {
    if (error instanceof MonthlyFormRequirementNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof MonthlyFormRequirementConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteMonthlyFormRequirementFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing requirement id");
  }
  await deleteMonthlyFormRequirement(access, id);
  revalidatePath(formsPath);
}

// --- Executed forms ---

export async function createMonthlyFormAction(
  _prev: MonthlyFormActionState | undefined,
  formData: FormData,
): Promise<MonthlyFormActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const parsed = monthlyFormCreateSchema.safeParse({
    vesselId: readFormString(formData, "vesselId") ?? "",
    ismTemplateId: emptyToUndefined(readFormString(formData, "ismTemplateId")),
    formName: readFormString(formData, "formName"),
    month: readFormString(formData, "month"),
    year: readFormString(formData, "year"),
    remarks: readFormString(formData, "remarks"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createMonthlyForm(access, parsed.data);
    revalidatePath(formsPath);
    redirect(`${formsPath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof MonthlyFormConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function generateMonthlyChecklistAction(
  _prev: MonthlyFormActionState | undefined,
  formData: FormData,
): Promise<MonthlyFormActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const parsed = monthlyFormGenerateSchema.safeParse({
    vesselId: emptyToUndefined(readFormString(formData, "vesselId")),
    month: emptyToUndefined(readFormString(formData, "month")),
    year: emptyToUndefined(readFormString(formData, "year")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const result = await generateMonthlyChecklist(access, parsed.data);
  revalidatePath(formsPath);
  return {
    ok: true,
    created: result.created,
    message:
      result.created === 0
        ? "No new checklist rows — all due forms already exist."
        : `Created ${result.created} checklist row${result.created === 1 ? "" : "s"}.`,
  };
}

export async function submitMonthlyFormAction(
  _prev: MonthlyFormActionState | undefined,
  formData: FormData,
): Promise<MonthlyFormActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const id = readFormString(formData, "executedFormId");
  if (!id) return { ok: false, message: "Missing form id." };

  const parsed = monthlyFormSubmitSchema.safeParse({
    remarks: readFormString(formData, "remarks"),
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
    await submitMonthlyForm(
      access,
      id,
      parsed.data,
      {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        bytes,
      },
    );
    revalidatePath(formsPath);
    revalidatePath(`${formsPath}/${id}`);
    return { ok: true, message: "Form submitted." };
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof MonthlyFormNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteMonthlyFormFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing form id");
  }
  await deleteMonthlyForm(access, id);
  revalidatePath(formsPath);
  redirect(formsPath);
}

export async function deleteMonthlyFormAttachmentAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const id = formData.get("id");
  const executedFormId = formData.get("executedFormId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing attachment id");
  }
  try {
    await deleteMonthlyFormAttachment(access, id);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    throw error;
  }
  if (typeof executedFormId === "string" && executedFormId.length > 0) {
    revalidatePath(`${formsPath}/${executedFormId}`);
  }
}
