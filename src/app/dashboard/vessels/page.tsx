import Link from "next/link";
import { listVessels } from "@/modules/vessels/vessel.controller";
import { formatImo } from "@/modules/vessels/vessel.model";

export const dynamic = "force-dynamic";

export default function VesselsPage() {
  const vessels = listVessels();

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

      <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {vessels.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-600 dark:text-zinc-400">
            No vessels yet.{" "}
            <Link href="/dashboard/vessels/new" className="font-medium text-[#0D2B45] underline-offset-4 hover:underline dark:text-sky-300">
              Create your first vessel
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">IMO</th>
                  <th className="px-4 py-3">Flag</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {vessels.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      <Link
                        href={`/dashboard/vessels/${v.id}`}
                        className="text-[#0D2B45] hover:underline dark:text-sky-300"
                      >
                        {v.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatImo(v.imoNumber)}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{v.flagState ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{v.vesselType ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/vessels/${v.id}/edit`}
                        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
