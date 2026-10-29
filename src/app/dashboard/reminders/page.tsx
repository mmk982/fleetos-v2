import { uuidSearchParam } from "@/lib/validation/search-params";
import { RemindersList } from "@/components/reminders-list";
import { listReminders } from "@/modules/reminders/reminder.controller";
import {
  REMINDER_PRIORITIES,
  REMINDER_STATUSES,
  REMINDER_TYPES,
} from "@/modules/reminders/reminder.model";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
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

  let rows;
  let vessels;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    rows = await listReminders(access, {
      vesselId: uuidSearchParam(sp.vesselId),
      type,
      priority,
      status,
    });
    vessels = await listSelectableVessels(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Reminders
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
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
