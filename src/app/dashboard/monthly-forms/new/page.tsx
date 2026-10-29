import Link from "next/link";
import { AccessDeniedNotice } from "@/components/access-denied-notice";
import { MonthlyFormCreateForm } from "@/components/monthly-form-create-form";
import { listIsmTemplates } from "@/modules/ism-templates/ismTemplate.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { planMonthlyFormsPageData } from "@/lib/auth/page-access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";
import type { UserRole } from "@/db/schema";

export default async function NewMonthlyFormPage() {
  const session = await requireSession();
  const access = toAccessContext(session);
  const plan = planMonthlyFormsPageData(access.role as UserRole | null);

  // Submit-only roles cannot create ad-hoc forms (create needs full access).
  if (!plan.canCreateAdHoc) {
    return (
      <AccessDeniedNotice
        title="You don't have access to this page"
        description="Your role is not allowed to create ad-hoc monthly forms."
      />
    );
  }

  let vessels;
  let templates;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    vessels = await listSelectableVessels(access);
    templates = await listIsmTemplates(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <Link
        href="/dashboard/monthly-forms"
        className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
      >
        ← Back to monthly forms
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
        Add ad-hoc form
      </h1>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">
        Create a form outside the checklist generator (on-demand or one-off).
      </p>
      <div className="mt-8 max-w-xl">
        <MonthlyFormCreateForm vessels={vessels} templates={templates} />
      </div>
    </main>
  );
}
