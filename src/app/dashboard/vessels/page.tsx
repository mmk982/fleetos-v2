import { VesselsList } from "@/components/vessels-list";
import { AccessDeniedNotice } from "@/components/access-denied-notice";
import { toAccessContext } from "@/lib/auth/access";
import { planVesselRegistryPageAccess } from "@/lib/auth/page-access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";
import { listVessels } from "@/modules/vessels/vessel.controller";
import type { UserRole, VesselRow } from "@/db/schema";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VesselsPage() {
  const session = await requireSession();
  const access = toAccessContext(session);

  if (planVesselRegistryPageAccess(access.role as UserRole | null) === "deny") {
    return (
      <AccessDeniedNotice
        title="You don't have access to this page"
        description="Only Admin users can manage the vessel registry."
      />
    );
  }

  let vessels: VesselRow[];
  try {
    vessels = await listVessels(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

  return (
    <main className="flex flex-1 flex-col p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Vessels
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Register fleet units, identifiers, and operational status.
          </p>
        </div>
        <Link
          href="/dashboard/vessels/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
        >
          Add vessel
        </Link>
      </div>

      {vessels.length === 0 ? (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="px-6 py-12 text-center text-sm text-[var(--text-tertiary)]">
            No vessels yet.{" "}
            <Link
              href="/dashboard/vessels/new"
              className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
            >
              Create your first vessel
            </Link>
            .
          </div>
        </div>
      ) : (
        <VesselsList vessels={vessels} />
      )}
    </main>
  );
}
