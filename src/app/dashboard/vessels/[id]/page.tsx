import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import { deleteVesselFormAction } from "@/modules/vessels/actions";
import { getVesselById } from "@/modules/vessels/vessel.controller";
import { formatImo, vesselStatusTone } from "@/modules/vessels/vessel.model";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

export default async function VesselDetailPage(props: PageProps) {
  const session = await requireSession();
  const { id } = await props.params;
  const vessel = await getVesselById(toAccessContext(session), id);
  if (!vessel) {
    notFound();
  }

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: "IMO",
      value: <Identifier>{formatImo(vessel.imoNumber)}</Identifier>,
    },
    { label: "MMSI", value: vessel.mmsi ?? "—" },
    { label: "Call sign", value: vessel.callSign ?? "—" },
    { label: "Flag state", value: vessel.flagState ?? "—" },
    { label: "Vessel type", value: vessel.vesselType ?? "—" },
    {
      label: "Gross tonnage",
      value: vessel.grossTonnage != null ? String(vessel.grossTonnage) : "—",
    },
    {
      label: "Year built",
      value: vessel.yearBuilt != null ? String(vessel.yearBuilt) : "—",
    },
    {
      label: "Status",
      value: (
        <StatusPill tone={vesselStatusTone(vessel.status)}>
          {vessel.status.charAt(0).toUpperCase() + vessel.status.slice(1)}
        </StatusPill>
      ),
    },
    { label: "Created", value: vessel.createdAt.toISOString() },
    { label: "Updated", value: vessel.updatedAt.toISOString() },
  ];

  return (
    <main className="flex flex-1 flex-col p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/vessels"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            ← Back to vessels
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Identifier>{vessel.name}</Identifier>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/vessels/${vessel.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#0D2B45] px-4 text-sm font-medium text-white"
          >
            Edit
          </Link>
          <ConfirmDeleteButton
            id={vessel.id}
            title="Delete vessel?"
            description="This permanently removes the vessel. Certificates and other linked records will block delete via RESTRICT if still present."
            action={deleteVesselFormAction}
          />
        </div>
      </div>

      <dl className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {row.label}
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{row.value}</dd>
          </div>
        ))}
      </dl>

      {vessel.notes ? (
        <section className="mt-8 max-w-3xl">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {vessel.notes}
          </p>
        </section>
      ) : null}
    </main>
  );
}
