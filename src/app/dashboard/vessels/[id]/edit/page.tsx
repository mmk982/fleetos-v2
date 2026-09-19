import Link from "next/link";
import { notFound } from "next/navigation";
import { VesselForm } from "@/components/vessel-form";
import { getVesselById } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditVesselPage(props: PageProps) {
  const session = await requireSession();
  const { id } = await props.params;
  const vessel = await getVesselById(toAccessContext(session), id);
  if (!vessel) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col p-8">
      <div className="mb-8">
        <Link
          href={`/dashboard/vessels/${vessel.id}`}
          className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
        >
          ← Back to vessel
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Edit vessel
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">{vessel.name}</p>
      </div>
      <VesselForm mode="edit" vesselId={vessel.id} defaultValues={vessel} />
    </main>
  );
}
