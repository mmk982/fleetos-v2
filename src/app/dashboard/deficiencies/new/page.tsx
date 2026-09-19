import Link from "next/link";
import { NewDeficiencyDrawer } from "@/components/new-deficiency-drawer";
import { listDeficiencySources } from "@/modules/deficiencies/deficiency.controller";
import { listPscInspections } from "@/modules/psc/psc.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

export default async function NewDeficiencyPage() {
  const session = await requireSession();
  const access = toAccessContext(session);
  const [vessels, sources, pscInspections] = await Promise.all([
    listSelectableVessels(access),
    listDeficiencySources(access),
    listPscInspections(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <Link
        href="/dashboard/deficiencies"
        className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
      >
        ← Back to deficiencies
      </Link>
      <NewDeficiencyDrawer
        vessels={vessels}
        sources={sources}
        pscInspections={pscInspections}
      />
    </main>
  );
}
