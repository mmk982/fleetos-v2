/**
 * Server Actions for Notifications (`PROJECT_PLAN.md` §12a).
 */
"use server";

import { revalidatePath } from "next/cache";
import { toAccessContext } from "@/lib/auth/access";
import { assertSameOriginMutation } from "@/lib/auth/request-guard";
import { requireSession } from "@/lib/auth/session";
import {
  markAllNotificationsRead,
  markNotificationRead,
  NotificationNotFoundError,
} from "./notifications.controller";

const notificationsPath = "/dashboard/notifications";

export async function markNotificationReadAction(id: string): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  try {
    await markNotificationRead(access, id);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) throw error;
    throw error;
  }
  revalidatePath("/dashboard");
  revalidatePath(notificationsPath);
}

export async function markAllReadAction(userId: string): Promise<void> {
  await assertSameOriginMutation();
  const session = await requireSession({ touch: true });
  const access = toAccessContext(session);
  await markAllNotificationsRead(access, userId);
  revalidatePath("/dashboard");
  revalidatePath(notificationsPath);
}
