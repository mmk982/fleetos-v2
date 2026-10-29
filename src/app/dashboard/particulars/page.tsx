import { ParticularsList } from "@/components/particulars-list";
import { listVesselParticularsSummary } from "@/modules/ship-particulars/particulars.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ParticularsPage() {
  const session = await requireSession();
  const access = toAccessContext(session);

  let rows;
  try {
    rows = await listVesselParticularsSummary(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Particulars
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Fleet-wide view of each vessel&apos;s current particulars.
        </p>
      </div>
      <ParticularsList rows={rows} />
    </main>
  );
}
