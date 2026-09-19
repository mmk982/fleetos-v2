/**
 * Server Actions for audits.
 *
 * Every action: {@link assertSameOriginMutation} →
 * {@link requireSession}(`touch: true`) → {@link toAccessContext} into the
 * controller (Phase 3 defense stack).
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import {
  AuditConflictError,
  AuditNotFoundError,
  createAudit,
  deleteAudit,
  updateAudit,
} from "./audit.controller";
import { auditCreateSchema, auditUpdateSchema } from "./validation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const auditsPath = "/dashboard/audits";

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

export type AuditActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createAuditAction(
  _prev: AuditActionState | undefined,
  formData: FormData,
): Promise<AuditActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId") ?? "",
    auditType: readFormString(formData, "auditType") ?? "",
    auditDate: readFormString(formData, "auditDate") ?? "",
    auditor: readFormString(formData, "auditor"),
    findingsCount: readFormString(formData, "findingsCount"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = auditCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createAudit(access, parsed.data);
    revalidatePath(auditsPath);
    redirect(`${auditsPath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof AuditConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateAuditAction(
  id: string,
  _prev: AuditActionState | undefined,
  formData: FormData,
): Promise<AuditActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const keys = [
    "vesselId",
    "auditType",
    "auditDate",
    "auditor",
    "findingsCount",
    "notes",
  ] as const;

  const raw: Record<string, string | undefined> = {};
  for (const key of keys) {
    const v = readFormString(formData, key);
    if (v !== undefined) raw[key] = v;
  }

  const parsed = auditUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updateAudit(access, id, parsed.data);
    revalidatePath(auditsPath);
    revalidatePath(`${auditsPath}/${id}`);
    revalidatePath(`${auditsPath}/${id}/edit`);
    redirect(`${auditsPath}/${id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof AuditNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof AuditConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deleteAuditFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing audit id");
  }
  await deleteAudit(access, id);
  revalidatePath(auditsPath);
  redirect(auditsPath);
}
