import Link from "next/link";
import { notFound } from "next/navigation";
import { EditPscInspectionDrawer } from "@/components/edit-psc-inspection-drawer";
import { getPscInspection } from "@/modules/psc/psc.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPscInspectionPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  let row;
  let vessels;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    row = await getPscInspection(access, id);
    vessels = await listSelectableVessels(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }
  if (!row) notFound();

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <Link
        href={`/dashboard/psc/${row.id}`}
        className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
      >
        ← Back to inspection
      </Link>
      <EditPscInspectionDrawer inspection={row} vessels={vessels} />
    </main>
  );
}
