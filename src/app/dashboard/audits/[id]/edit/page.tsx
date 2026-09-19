import Link from "next/link";
import { notFound } from "next/navigation";
import { EditAuditDrawer } from "@/components/edit-audit-drawer";
import { getAudit } from "@/modules/audits/audit.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditAuditPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;
  const [row, vessels] = await Promise.all([
    getAudit(access, id),
    listSelectableVessels(access),
  ]);
  if (!row) notFound();

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <Link
        href={`/dashboard/audits/${row.id}`}
        className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
      >
        ← Back to audit
      </Link>
      <EditAuditDrawer audit={row} vessels={vessels} />
    </main>
  );
}
