/**
 * Server Actions for the Vessels module — the form-submission boundary
 * between `vessel-form.tsx` and `vessel.controller.ts`. Owns: reading
 * `FormData`, Zod validation + field-error mapping, calling the controller,
 * and `revalidatePath`/`redirect` afterward. Reference shape for every later
 * module's `actions.ts` (`PROJECT_PLAN.md` Conventions section).
 *
 * Every action begins with {@link assertSameOriginMutation} then
 * {@link requireSession}, and passes {@link toAccessContext} into the
 * controller — layers two and three of the Phase 3 defense stack.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import {
  createVessel,
  deleteVessel,
  updateVessel,
  VesselConflictError,
} from "./vessel.controller";
import { vesselCreateSchema, vesselUpdateSchema } from "./validation";

/**
 * `redirect()` in a Server Action works by throwing a special error Next.js
 * catches upstream — every `try`/`catch` around a `redirect()` call must
 * re-throw it (checked via this helper) rather than treating it as a real
 * failure, or the redirect silently never happens.
 */
function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}

const vesselsPath = "/dashboard/vessels";

/** Reads a `FormData` field as a string, or `undefined` if the key is absent (distinct from an empty string, which the field *was* present but blank). */
function readFormString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) {
    return undefined;
  }
  return String(v);
}

/**
 * `useActionState` result shape. `ok: true` carries no payload — callers
 * that need the created/updated row read it via `redirect()` to the detail
 * page instead, not via this state (see `createVesselAction`).
 */
export type VesselActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Creates a vessel from a submitted `<form>`. On success, redirects to the
 * new vessel's detail page rather than returning `{ ok: true }` — there's no
 * "stay on the create form" success state in this UI.
 */
export async function createVesselAction(
  _prev: VesselActionState | undefined,
  formData: FormData,
): Promise<VesselActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw = {
    name: readFormString(formData, "name") ?? "",
    imoNumber: readFormString(formData, "imoNumber"),
    mmsi: readFormString(formData, "mmsi"),
    callSign: readFormString(formData, "callSign"),
    flagState: readFormString(formData, "flagState"),
    vesselType: readFormString(formData, "vesselType"),
    grossTonnage: readFormString(formData, "grossTonnage"),
    yearBuilt: readFormString(formData, "yearBuilt"),
    status: readFormString(formData, "status"),
    notes: readFormString(formData, "notes"),
  };

  const parsed = vesselCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const pathKey = issue.path[0];
      if (typeof pathKey === "string") {
        fieldErrors[pathKey] ??= [];
        fieldErrors[pathKey].push(issue.message);
      }
    }
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  try {
    const vessel = await createVessel(access, parsed.data);
    revalidatePath(vesselsPath);
    redirect(`${vesselsPath}/${vessel.id}`);
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    if (error instanceof VesselConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

/**
 * Updates a vessel from a submitted edit `<form>`. Bound with `.bind(null,
 * id)` at the call site (see `vessel-form.tsx`) so it matches the
 * `useActionState`-required `(prev, formData)` signature despite needing the
 * extra `id` parameter. Only form fields actually present are validated/
 * applied — see `vesselUpdateSchema`.
 */
export async function updateVesselAction(
  id: string,
  _prev: VesselActionState | undefined,
  formData: FormData,
): Promise<VesselActionState> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const raw: Record<string, string | undefined> = {};
  for (const key of [
    "name",
    "imoNumber",
    "mmsi",
    "callSign",
    "flagState",
    "vesselType",
    "grossTonnage",
    "yearBuilt",
    "status",
    "notes",
  ] as const) {
    const v = readFormString(formData, key);
    if (v !== undefined) {
      raw[key] = v;
    }
  }

  const parsed = vesselUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const pathKey = issue.path[0];
      if (typeof pathKey === "string") {
        fieldErrors[pathKey] ??= [];
        fieldErrors[pathKey].push(issue.message);
      }
    }
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  try {
    await updateVessel(access, id, parsed.data);
    revalidatePath(vesselsPath);
    revalidatePath(`${vesselsPath}/${id}`);
    revalidatePath(`${vesselsPath}/${id}/edit`);
    redirect(`${vesselsPath}/${id}`);
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    if (error instanceof VesselConflictError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

/**
 * Deletes a vessel, called from a plain `<form action={...}>` (not
 * `useActionState`) on the detail page — hence `Promise<void>` rather than
 * the `VesselActionState` shape, and hence throwing on a missing id instead
 * of returning a field error there's no form to display it against.
 */
export async function deleteVesselFormAction(formData: FormData): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);

  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing vessel id");
  }
  await deleteVessel(access, id);
  revalidatePath(vesselsPath);
  redirect(vesselsPath);
}
