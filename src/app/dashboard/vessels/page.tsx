import Link from "next/link";
import { VesselsList } from "@/components/vessels-list";
import { listVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function VesselsPage() {
  const session = await requireSession();
  const vessels = await listVessels(toAccessContext(session));

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
