/**
 * Server Actions for the Certificates module — form boundary between UI and
 * `certificate.controller.ts`. Every action begins with
 * {@link assertSameOriginMutation} → {@link requireSession} →
 * {@link toAccessContext} into the controller (Phase 3 defense stack).
 *
 * Spec: PROJECT_PLAN.md §1 Server actions / API.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import {
  addCertificateEvent,
  AttachmentNotFoundError,
  AttachmentValidationError,
  CertificateConflictError,
  CertificateNotFoundError,
  createCertificate,
  deleteCertificate,
  deleteCertificateAttachment,
  updateCertificate,
  uploadCertificateAttachment,
} from "./certificate.controller";
import {
  certificateCreateSchema,
  certificateEventCreateSchema,
  certificateUpdateSchema,
} from "./validation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const certificatesPath = "/dashboard/certificates";

function readFormString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) {
    return undefined;
  }
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

export type CertificateActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createCertificateAction(
  _prev: CertificateActionState | undefined,
  formData: FormData,
): Promise<CertificateActionState> {
  await assertSameOriginMutation();
  const session = await requireSession();
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId") ?? "",
    certificateTypeId: readFormString(formData, "certificateTypeId") ?? "",
    issuingAuthorityId: readFormString(formData, "issuingAuthorityId"),
    certificateNumber: readFormString(formData, "certificateNumber"),
    issueDate: readFormString(formData, "issueDate"),
    expiryDate: readFormString(formData, "expiryDate"),
    windowOpenDate: readFormString(formData, "windowOpenDate"),
    windowCloseDate: readFormString(formData, "windowCloseDate"),
    linkedToDryDock: readFormString(formData, "linkedToDryDock") ?? "false",
    customOffsetDays: readFormString(formData, "customOffsetDays"),
    lifecycleStatus: readFormString(formData, "lifecycleStatus"),
    remarks: readFormString(formData, "remarks"),
  };

  const parsed = certificateCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createCertificate(access, parsed.data);
    revalidatePath(certificatesPath);
    redirect(`${certificatesPath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof CertificateConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateCertificateAction(
  id: string,
  _prev: CertificateActionState | undefined,
  formData: FormData,
): Promise<CertificateActionState> {
  await assertSameOriginMutation();
  const session = await requireSession();
  const access = toAccessContext(session);

  const keys = [
    "vesselId",
    "certificateTypeId",
    "issuingAuthorityId",
    "certificateNumber",
    "issueDate",
    "expiryDate",
    "windowOpenDate",
    "windowCloseDate",
    "linkedToDryDock",
    "customOffsetDays",
    "lifecycleStatus",
    "remarks",
  ] as const;

  const raw: Record<string, string | undefined> = {};
  for (const key of keys) {
    const v = readFormString(formData, key);
    if (v !== undefined) {
      raw[key] = v;
    }
  }

  const parsed = certificateUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateCertificate(access, id, parsed.data);
    revalidatePath(certificatesPath);
    revalidatePath(`${certificatesPath}/${id}`);
    revalidatePath(`${certificatesPath}/${id}/edit`);
    redirect(`${certificatesPath}/${id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof CertificateNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof CertificateConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteCertificateFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession();
  const access = toAccessContext(session);

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing certificate id");
  }
  await deleteCertificate(access, id);
  revalidatePath(certificatesPath);
  redirect(certificatesPath);
}

export async function addCertificateEventAction(
  _prev: CertificateActionState | undefined,
  formData: FormData,
): Promise<CertificateActionState> {
  await assertSameOriginMutation();
  const session = await requireSession();
  const access = toAccessContext(session);

  const raw = {
    certificateId: readFormString(formData, "certificateId") ?? "",
    eventType: readFormString(formData, "eventType") ?? "",
    eventDate: readFormString(formData, "eventDate") ?? "",
    newExpiryDate: readFormString(formData, "newExpiryDate"),
    note: readFormString(formData, "note"),
  };

  const parsed = certificateEventCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await addCertificateEvent(access, parsed.data);
    revalidatePath(`${certificatesPath}/${parsed.data.certificateId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof CertificateNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function uploadCertificateAttachmentAction(
  _prev: CertificateActionState | undefined,
  formData: FormData,
): Promise<CertificateActionState> {
  await assertSameOriginMutation();
  const session = await requireSession();
  const access = toAccessContext(session);

  const certificateId = readFormString(formData, "certificateId");
  if (!certificateId) {
    return { ok: false, message: "Missing certificate id." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadCertificateAttachment(access, certificateId, {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      bytes,
    });
    revalidatePath(`${certificatesPath}/${certificateId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof CertificateNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteCertificateAttachmentAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession();
  const access = toAccessContext(session);

  const id = formData.get("id");
  const certificateId = formData.get("certificateId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing attachment id");
  }
  try {
    await deleteCertificateAttachment(access, id);
  } catch (error) {
    if (!(error instanceof AttachmentNotFoundError)) {
      throw error;
    }
  }
  if (typeof certificateId === "string" && certificateId.length > 0) {
    revalidatePath(`${certificatesPath}/${certificateId}`);
  }
}
