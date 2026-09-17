import Link from "next/link";
import { NewDeficiencyDrawer } from "@/components/new-deficiency-drawer";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

export default async function NewDeficiencyPage() {
  const session = await requireSession();
  const vessels = await listSelectableVessels(toAccessContext(session));

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <Link
        href="/dashboard/deficiencies"
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        ← Back to deficiencies
      </Link>
      <NewDeficiencyDrawer vessels={vessels} />
    </main>
  );
}
