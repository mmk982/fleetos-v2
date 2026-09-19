/**
 * Server Actions for PSC inspections.
 *
 * Every action: {@link assertSameOriginMutation} →
 * {@link requireSession}(`touch: true`) → {@link toAccessContext} into the
 * controller (Phase 3 defense stack).
 *
 * Spec: PROJECT_PLAN.md §7b.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import {
  createPscInspection,
  deletePscInspection,
  PscInspectionConflictError,
  PscInspectionNotFoundError,
  updatePscInspection,
} from "./psc.controller";
import {
  pscInspectionCreateSchema,
  pscInspectionUpdateSchema,
} from "./validation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const pscPath = "/dashboard/psc";

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

export type PscInspectionActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createPscInspectionAction(
  _prev: PscInspectionActionState | undefined,
  formData: FormData,
): Promise<PscInspectionActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    vesselId: readFormString(formData, "vesselId") ?? "",
    port: readFormString(formData, "port") ?? "",
    inspectionDate: readFormString(formData, "inspectionDate") ?? "",
    authority: readFormString(formData, "authority") ?? "",
    result: readFormString(formData, "result") ?? "",
    detained: readFormString(formData, "detained") ?? "false",
    inspectorName: readFormString(formData, "inspectorName"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = pscInspectionCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    const row = await createPscInspection(access, parsed.data);
    revalidatePath(pscPath);
    redirect(`${pscPath}/${row.id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof PscInspectionConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updatePscInspectionAction(
  id: string,
  _prev: PscInspectionActionState | undefined,
  formData: FormData,
): Promise<PscInspectionActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const keys = [
    "vesselId",
    "port",
    "inspectionDate",
    "authority",
    "result",
    "detained",
    "inspectorName",
    "notes",
  ] as const;

  const raw: Record<string, string | undefined> = {};
  for (const key of keys) {
    const v = readFormString(formData, key);
    if (v !== undefined) raw[key] = v;
  }
  // Unchecked checkbox omits the field — treat as false on update.
  raw.detained = readFormString(formData, "detained") ?? "false";

  const parsed = pscInspectionUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  try {
    await updatePscInspection(access, id, parsed.data);
    revalidatePath(pscPath);
    revalidatePath(`${pscPath}/${id}`);
    revalidatePath(`${pscPath}/${id}/edit`);
    redirect(`${pscPath}/${id}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof PscInspectionNotFoundError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof PscInspectionConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function deletePscInspectionFormAction(
  formData: FormData,
): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing PSC inspection id");
  }
  await deletePscInspection(access, id);
  revalidatePath(pscPath);
  redirect(pscPath);
}
