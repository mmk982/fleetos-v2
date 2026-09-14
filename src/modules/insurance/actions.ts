/**
 * Server Actions for Insurance — form boundary + attachments.
 *
 * Every action: {@link assertSameOriginMutation} →
 * {@link requireSession}(`touch: true`) → {@link toAccessContext} into the
 * controller (Phase 3 defense stack).
 *
 * Spec: PROJECT_PLAN.md §4.
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
  createInsurancePolicy,
  deleteInsuranceAttachment,
  deleteInsurancePolicy,
  InsuranceConflictError,
  InsuranceNotFoundError,
  updateInsurancePolicy,
  uploadInsuranceAttachment,
} from "./insurance.controller";
import {
  insuranceCreateSchema,
  insuranceUpdateSchema,
} from "./validation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const insurancePath = "/dashboard/insurance";

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

export type InsuranceActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createInsurancePolicyAction(
  _prev: InsuranceActionState | undefined,
  formData: FormData,
): Promise<InsuranceActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId") ?? "",
    policyType: readFormString(formData, "policyType") ?? "",
    provider: readFormString(formData, "provider"),
    policyNumber: readFormString(formData, "policyNumber"),
    coverageAmount: readFormString(formData, "coverageAmount"),
    currency: readFormString(formData, "currency"),
    startDate: readFormString(formData, "startDate"),
    expiryDate: readFormString(formData, "expiryDate"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = insuranceCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createInsurancePolicy(access, parsed.data);
    revalidatePath(insurancePath);
    redirect(`${insurancePath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof InsuranceConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateInsurancePolicyAction(
  id: string,
  _prev: InsuranceActionState | undefined,
  formData: FormData,
): Promise<InsuranceActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId"),
    policyType: readFormString(formData, "policyType"),
    provider: readFormString(formData, "provider"),
    policyNumber: readFormString(formData, "policyNumber"),
    coverageAmount: readFormString(formData, "coverageAmount"),
    currency: readFormString(formData, "currency"),
    startDate: readFormString(formData, "startDate"),
    expiryDate: readFormString(formData, "expiryDate"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = insuranceUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateInsurancePolicy(access, id, parsed.data);
    revalidatePath(insurancePath);
    revalidatePath(`${insurancePath}/${id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof InsuranceNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof InsuranceConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

/** Form-style delete — name locked by PROJECT_PLAN.md §4. */
export async function deleteInsuranceFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing insurance policy id");
  }
  await deleteInsurancePolicy(access, id);
  revalidatePath(insurancePath);
  redirect(insurancePath);
}

export async function uploadInsuranceAttachmentAction(
  _prev: InsuranceActionState | undefined,
  formData: FormData,
): Promise<InsuranceActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const insurancePolicyId = readFormString(formData, "insurancePolicyId");
  if (!insurancePolicyId) {
    return { ok: false, message: "Missing insurance policy id." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadInsuranceAttachment(access, insurancePolicyId, {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      bytes,
    });
    revalidatePath(`${insurancePath}/${insurancePolicyId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof InsuranceNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteInsuranceAttachmentAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const id = formData.get("id");
  const insurancePolicyId = formData.get("insurancePolicyId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing attachment id");
  }
  try {
    await deleteInsuranceAttachment(access, id);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    throw error;
  }
  if (typeof insurancePolicyId === "string" && insurancePolicyId.length > 0) {
    revalidatePath(`${insurancePath}/${insurancePolicyId}`);
  }
}
