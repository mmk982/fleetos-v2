/**
 * Server Actions for Settings — General + Company Profile (`PROJECT_PLAN.md` §7a).
 */
"use server";

import { revalidatePath } from "next/cache";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import { setCriticalDays } from "@/lib/settings/critical-days";
import { optionalTrimmedString } from "@/lib/validation/form-fields";
import { z } from "zod";
import {
  clearCompanyLogo,
  LogoValidationError,
  updateCompanyProfile,
  uploadCompanyLogo,
} from "./company-profile.controller";

export type SettingsActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const criticalDaysSchema = z.object({
  criticalDays: z.coerce.number().int().min(1).max(365),
});

export async function setCriticalDaysAction(
  _prev: SettingsActionState | undefined,
  formData: FormData,
): Promise<SettingsActionState> {
  await assertSameOriginMutation();
  await requireSession({ touch: true });

  const parsed = criticalDaysSchema.safeParse({
    criticalDays: formData.get("criticalDays"),
  });
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

  await setCriticalDays(parsed.data.criticalDays);
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Saved." };
}

const companyProfileSchema = z.object({
  companyName: optionalTrimmedString,
  registrationNumber: optionalTrimmedString,
  address: optionalTrimmedString,
  contactEmail: optionalTrimmedString,
  contactPhone: optionalTrimmedString,
  timezone: optionalTrimmedString,
  dateFormat: optionalTrimmedString,
});

function readFormString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) return undefined;
  return String(v);
}

export async function updateCompanyProfileAction(
  _prev: SettingsActionState | undefined,
  formData: FormData,
): Promise<SettingsActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));

  const parsed = companyProfileSchema.safeParse({
    companyName: readFormString(formData, "companyName"),
    registrationNumber: readFormString(formData, "registrationNumber"),
    address: readFormString(formData, "address"),
    contactEmail: readFormString(formData, "contactEmail"),
    contactPhone: readFormString(formData, "contactPhone"),
    timezone: readFormString(formData, "timezone"),
    dateFormat: readFormString(formData, "dateFormat"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Please fix the highlighted fields." };
  }

  await updateCompanyProfile(access, parsed.data);
  revalidatePath("/dashboard/settings/company-profile");
  revalidatePath("/dashboard");
  revalidatePath("/login");
  return { ok: true, message: "Saved." };
}

export async function uploadCompanyLogoAction(
  _prev: SettingsActionState | undefined,
  formData: FormData,
): Promise<SettingsActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a JPEG or PNG logo file." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    await uploadCompanyLogo(access, {
      name: file.name,
      type: file.type,
      size: file.size,
      bytes,
    });
    revalidatePath("/dashboard/settings/company-profile");
    revalidatePath("/dashboard");
    revalidatePath("/login");
    return { ok: true, message: "Logo updated." };
  } catch (error) {
    if (error instanceof LogoValidationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function clearCompanyLogoAction(): Promise<SettingsActionState> {
  await assertSameOriginMutation();
  const access = toAccessContext(await requireSession({ touch: true }));
  await clearCompanyLogo(access);
  revalidatePath("/dashboard/settings/company-profile");
  revalidatePath("/dashboard");
  revalidatePath("/login");
  return { ok: true, message: "Logo removed." };
}
