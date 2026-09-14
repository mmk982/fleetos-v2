import Link from "next/link";
import { MonthlyFormCreateForm } from "@/components/monthly-form-create-form";
import { listIsmTemplates } from "@/modules/ism-templates/ismTemplate.controller";
import { listVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

export default async function NewMonthlyFormPage() {
  const session = await requireSession();
  const access = toAccessContext(session);
  const [vessels, templates] = await Promise.all([
    listVessels(access),
    listIsmTemplates(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <Link
        href="/dashboard/monthly-forms"
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        ← Back to monthly forms
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Add ad-hoc form
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Create a form outside the checklist generator (on-demand or one-off).
      </p>
      <div className="mt-8 max-w-xl">
        <MonthlyFormCreateForm vessels={vessels} templates={templates} />
      </div>
    </main>
  );
}
