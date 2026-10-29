import Link from "next/link";
import { notFound } from "next/navigation";
import { ReminderForm } from "@/components/reminder-form";
import { getReminderById } from "@/modules/reminders/reminder.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditReminderPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  let reminder;
  let vessels;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    reminder = await getReminderById(access, id);
    vessels = await listSelectableVessels(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }
  if (!reminder) notFound();

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="mb-6">
        <Link
          href="/dashboard/reminders"
          className="text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
        >
          ← Reminders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Edit reminder
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Related kind/id are stored as-is — no link resolution.
        </p>
      </div>

      <div className="max-w-2xl">
        <ReminderForm
          mode="edit"
          reminderId={reminder.id}
          defaultValues={reminder}
          vessels={vessels}
        />
      </div>
    </main>
  );
}
