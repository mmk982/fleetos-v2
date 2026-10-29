import Link from "next/link";
import { ReminderForm } from "@/components/reminder-form";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewReminderPage() {
  const session = await requireSession();
  const access = toAccessContext(session);

  let vessels;
  try {
    vessels = await listSelectableVessels(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

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
          New reminder
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Create a user-set nudge. Leave vessel blank for fleet-wide.
        </p>
      </div>

      <div className="max-w-2xl">
        <ReminderForm mode="create" vessels={vessels} />
      </div>
    </main>
  );
}
