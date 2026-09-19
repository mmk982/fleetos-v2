import Link from "next/link";
import { NewPscInspectionDrawer } from "@/components/new-psc-inspection-drawer";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

export default async function NewPscInspectionPage() {
  const session = await requireSession();
  const vessels = await listSelectableVessels(toAccessContext(session));

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <Link
        href="/dashboard/psc"
        className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
      >
        ← Back to PSC
      </Link>
      <NewPscInspectionDrawer vessels={vessels} />
    </main>
  );
}
