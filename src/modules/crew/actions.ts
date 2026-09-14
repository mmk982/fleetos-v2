/**
 * Server Actions for Crew — members, certificates, attachments, scrub-PII.
 *
 * Every action: {@link assertSameOriginMutation} →
 * {@link requireSession}(`touch: true`) → {@link toAccessContext} into the
 * controller (Phase 3 defense stack).
 *
 * Spec: PROJECT_PLAN.md §3 + Phase 4 scrub / access_logs.
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
  createCrewCertificate,
  CrewCertificateConflictError,
  CrewCertificateNotFoundError,
  deleteCrewCertificate,
  deleteCrewCertificateAttachment,
  updateCrewCertificate,
  uploadCrewCertificateAttachment,
} from "./crew-certificate.controller";
import {
  createCrewMember,
  CrewConflictError,
  CrewMemberNotFoundError,
  deleteCrewMember,
  scrubCrewMemberPii,
  updateCrewMember,
} from "./crew.controller";
import {
  crewCertificateCreateSchema,
  crewCertificateUpdateSchema,
  crewMemberCreateSchema,
  crewMemberUpdateSchema,
} from "./validation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const crewPath = "/dashboard/crew";

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

export type CrewActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createCrewMemberAction(
  _prev: CrewActionState | undefined,
  formData: FormData,
): Promise<CrewActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    firstName: readFormString(formData, "firstName") ?? "",
    lastName: readFormString(formData, "lastName") ?? "",
    categoryId: readFormString(formData, "categoryId"),
    nationality: readFormString(formData, "nationality"),
    dateOfBirth: readFormString(formData, "dateOfBirth"),
    vesselId: readFormString(formData, "vesselId"),
    status: readFormString(formData, "status"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = crewMemberCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createCrewMember(access, parsed.data);
    revalidatePath(crewPath);
    redirect(`${crewPath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof CrewConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateCrewMemberAction(
  id: string,
  _prev: CrewActionState | undefined,
  formData: FormData,
): Promise<CrewActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    firstName: readFormString(formData, "firstName"),
    lastName: readFormString(formData, "lastName"),
    categoryId: readFormString(formData, "categoryId"),
    nationality: readFormString(formData, "nationality"),
    dateOfBirth: readFormString(formData, "dateOfBirth"),
    vesselId: readFormString(formData, "vesselId"),
    status: readFormString(formData, "status"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = crewMemberUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateCrewMember(access, id, parsed.data);
    revalidatePath(crewPath);
    revalidatePath(`${crewPath}/${id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof CrewMemberNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof CrewConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteCrewMemberFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing crew member id");
  }
  await deleteCrewMember(access, id);
  revalidatePath(crewPath);
  redirect(crewPath);
}

/** GDPR erasure — nulls PII + removes certificate attachment files. */
export async function scrubCrewMemberPiiFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing crew member id");
  }
  await scrubCrewMemberPii(access, id);
  revalidatePath(crewPath);
  revalidatePath(`${crewPath}/${id}`);
}

export async function createCrewCertificateAction(
  _prev: CrewActionState | undefined,
  formData: FormData,
): Promise<CrewActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    crewMemberId: readFormString(formData, "crewMemberId") ?? "",
    name: readFormString(formData, "name") ?? "",
    documentNumber: readFormString(formData, "documentNumber"),
    issuingAuthority: readFormString(formData, "issuingAuthority"),
    endorsementTypeId: readFormString(formData, "endorsementTypeId"),
    issueDate: readFormString(formData, "issueDate"),
    expiryDate: readFormString(formData, "expiryDate"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = crewCertificateCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await createCrewCertificate(access, parsed.data);
    revalidatePath(`${crewPath}/${parsed.data.crewMemberId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof CrewMemberNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof CrewCertificateConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateCrewCertificateAction(
  certId: string,
  crewMemberId: string,
  _prev: CrewActionState | undefined,
  formData: FormData,
): Promise<CrewActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    name: readFormString(formData, "name"),
    documentNumber: readFormString(formData, "documentNumber"),
    issuingAuthority: readFormString(formData, "issuingAuthority"),
    endorsementTypeId: readFormString(formData, "endorsementTypeId"),
    issueDate: readFormString(formData, "issueDate"),
    expiryDate: readFormString(formData, "expiryDate"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = crewCertificateUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateCrewCertificate(access, certId, parsed.data);
    revalidatePath(`${crewPath}/${crewMemberId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof CrewCertificateNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof CrewCertificateConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteCrewCertificateFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  const crewMemberId = formData.get("crewMemberId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing certificate id");
  }
  await deleteCrewCertificate(access, id);
  if (typeof crewMemberId === "string" && crewMemberId.length > 0) {
    revalidatePath(`${crewPath}/${crewMemberId}`);
  }
  revalidatePath(crewPath);
}

export async function uploadCrewCertificateAttachmentAction(
  _prev: CrewActionState | undefined,
  formData: FormData,
): Promise<CrewActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const crewCertificateId = readFormString(formData, "crewCertificateId");
  const crewMemberId = readFormString(formData, "crewMemberId");
  if (!crewCertificateId) {
    return { ok: false, message: "Missing certificate id." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await uploadCrewCertificateAttachment(access, crewCertificateId, {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      bytes,
    });
    if (crewMemberId) revalidatePath(`${crewPath}/${crewMemberId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof CrewCertificateNotFoundError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteCrewCertificateAttachmentAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const id = formData.get("id");
  const crewMemberId = formData.get("crewMemberId");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing attachment id");
  }
  try {
    await deleteCrewCertificateAttachment(access, id);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    throw error;
  }
  if (typeof crewMemberId === "string" && crewMemberId.length > 0) {
    revalidatePath(`${crewPath}/${crewMemberId}`);
  }
}
