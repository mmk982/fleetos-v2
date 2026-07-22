"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function isNextRedirect(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.includes("NEXT_REDIRECT");
}
import {
  createVessel,
  deleteVessel,
  updateVessel,
  VesselConflictError,
} from "./vessel.controller";
import { vesselCreateSchema, vesselUpdateSchema } from "./validation";

const vesselsPath = "/dashboard/vessels";

function readFormString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) {
    return undefined;
  }
  return String(v);
}

export type VesselActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function createVesselAction(
  _prev: VesselActionState | undefined,
  formData: FormData,
): Promise<VesselActionState> {
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
    const vessel = createVessel(parsed.data);
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

export async function updateVesselAction(
  id: string,
  _prev: VesselActionState | undefined,
  formData: FormData,
): Promise<VesselActionState> {
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
    updateVessel(id, parsed.data);
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

export async function deleteVesselFormAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing vessel id");
  }
  deleteVessel(id);
  revalidatePath(vesselsPath);
  redirect(vesselsPath);
}
