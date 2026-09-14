/**
 * Server Actions for Settings — General (`PROJECT_PLAN.md` §7a).
 */
"use server";

import { revalidatePath } from "next/cache";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import { setCriticalDays } from "@/lib/settings/critical-days";
import { z } from "zod";

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
