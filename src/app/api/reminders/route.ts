import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import type {
  ReminderPriority,
  ReminderStatus,
  ReminderType,
} from "@/db/schema";
import {
  createReminder,
  listReminders,
  ReminderConflictError,
} from "@/modules/reminders/reminder.controller";
import {
  REMINDER_PRIORITIES,
  REMINDER_STATUSES,
  REMINDER_TYPES,
} from "@/modules/reminders/reminder.model";
import { reminderCreateSchema } from "@/modules/reminders/validation";

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const vesselId = url.searchParams.get("vesselId") ?? undefined;
  const typeParam = url.searchParams.get("type");
  const priorityParam = url.searchParams.get("priority");
  const statusParam = url.searchParams.get("status");

  const type =
    typeParam && (REMINDER_TYPES as readonly string[]).includes(typeParam)
      ? (typeParam as ReminderType)
      : undefined;
  const priority =
    priorityParam &&
    (REMINDER_PRIORITIES as readonly string[]).includes(priorityParam)
      ? (priorityParam as ReminderPriority)
      : undefined;
  const status =
    statusParam &&
    (REMINDER_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as ReminderStatus)
      : undefined;

  const data = await listReminders(toAccessContext(session), {
    vesselId,
    type,
    priority,
    status,
  });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reminderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await createReminder(access, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ReminderConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
