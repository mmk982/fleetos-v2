import { RemindersList } from "@/components/reminders-list";
import { listReminders } from "@/modules/reminders/reminder.controller";
import {
  REMINDER_PRIORITIES,
  REMINDER_STATUSES,
  REMINDER_TYPES,
} from "@/modules/reminders/reminder.model";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import type {
  ReminderPriority,
  ReminderStatus,
  ReminderType,
} from "@/db/schema";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  type?: string;
  priority?: string;
  status?: string;
}>;

export default async function RemindersPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const type = REMINDER_TYPES.includes(sp.type as ReminderType)
    ? (sp.type as ReminderType)
    : undefined;
  const priority = REMINDER_PRIORITIES.includes(sp.priority as ReminderPriority)
    ? (sp.priority as ReminderPriority)
    : undefined;
  const status = REMINDER_STATUSES.includes(sp.status as ReminderStatus)
    ? (sp.status as ReminderStatus)
    : undefined;

  const [rows, vessels] = await Promise.all([
    listReminders(access, {
      vesselId: sp.vesselId || undefined,
      type,
      priority,
      status,
    }),
    listSelectableVessels(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Reminders
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          User-set nudges — separate from system Alerts.
        </p>
      </div>

      <RemindersList
        rows={rows}
        vessels={vessels}
        initialFilters={{
          vesselId: sp.vesselId ?? "",
          type: sp.type ?? "",
          priority: sp.priority ?? "",
          status: sp.status ?? "",
        }}
      />
    </main>
  );
}
