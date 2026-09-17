import Link from "next/link";
import { VesselsList } from "@/components/vessels-list";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import { listVessels } from "@/modules/vessels/vessel.controller";
import type { VesselRow } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function VesselsPage() {
  const session = await requireSession();
  const access = toAccessContext(session);

  let vessels: VesselRow[] | null = null;
  try {
    vessels = await listVessels(access);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
  }

  if (!vessels) {
    return (
      <main className="flex flex-1 flex-col p-8" dir="auto">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Admin access required</p>
          <p className="mt-1">
            Only Admin users can manage the vessel registry.{" "}
            <Link
              href="/dashboard"
              className="underline underline-offset-2"
            >
              Back to Dashboard
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Vessels
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Register fleet units, identifiers, and operational status.
          </p>
        </div>
        <Link
          href="/dashboard/vessels/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#0D2B45] px-4 text-sm font-medium text-white"
        >
          Add vessel
        </Link>
      </div>

      {vessels.length === 0 ? (
        <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="px-6 py-12 text-center text-sm text-zinc-600 dark:text-zinc-400">
            No vessels yet.{" "}
            <Link
              href="/dashboard/vessels/new"
              className="font-medium text-[#0D2B45] underline-offset-4 hover:underline dark:text-sky-300"
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
