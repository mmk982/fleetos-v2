import Link from "next/link";
import { notFound } from "next/navigation";
import { EditDeficiencyDrawer } from "@/components/edit-deficiency-drawer";
import { getDeficiencyById } from "@/modules/deficiencies/deficiency.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditDeficiencyPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;
  const [row, vessels] = await Promise.all([
    getDeficiencyById(access, id),
    listSelectableVessels(access),
  ]);
  if (!row) notFound();

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <Link
        href={`/dashboard/deficiencies/${row.id}`}
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        ← Back to deficiency
      </Link>
      <EditDeficiencyDrawer deficiency={row} vessels={vessels} />
    </main>
  );
}
