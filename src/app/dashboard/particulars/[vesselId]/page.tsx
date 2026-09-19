import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ParticularsAttachments } from "@/components/particulars-attachments";
import { ParticularsVesselActions } from "@/components/particulars-vessel-actions";
import { Identifier } from "@/components/ui/identifier";
import { deleteParticularsFormAction } from "@/modules/ship-particulars/actions";
import { getParticularsForVessel } from "@/modules/ship-particulars/particulars.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";

type PageProps = { params: Promise<{ vesselId: string }> };

export default async function ParticularsVesselPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { vesselId } = await props.params;

  const [detail, vessels] = await Promise.all([
    getParticularsForVessel(access, vesselId),
    listSelectableVessels(access),
  ]);
  if (!detail) notFound();

  const current = detail.current;
  const history = detail.history.filter((r) => !r.isCurrent);

  const fields: { label: string; value: ReactNode }[] = current
    ? [
        { label: "Class society", value: current.classSociety ?? "—" },
        { label: "Port of registry", value: current.portOfRegistry ?? "—" },
        { label: "Owner", value: current.owner ?? "—" },
        { label: "Manager", value: current.manager ?? "—" },
        { label: "DWT", value: current.deadweightTonnage ?? "—" },
        { label: "NRT", value: current.netRegisteredTonnage ?? "—" },
        { label: "LOA (m)", value: current.lengthOverall ?? "—" },
        { label: "Breadth (m)", value: current.breadth ?? "—" },
        { label: "Depth (m)", value: current.depth ?? "—" },
        { label: "Draft (m)", value: current.draft ?? "—" },
        { label: "Main engine", value: current.mainEngine ?? "—" },
        { label: "Aux engines", value: current.auxEngines ?? "—" },
        { label: "Cargo capacity", value: current.cargoCapacity ?? "—" },
        { label: "Ballast capacity", value: current.ballastCapacity ?? "—" },
        { label: "Fuel oil capacity", value: current.fuelOilCapacity ?? "—" },
        {
          label: "Fresh water capacity",
          value: current.freshWaterCapacity ?? "—",
        },
        { label: "Effective date", value: current.effectiveDate ?? "—" },
        { label: "Notes", value: current.notes ?? "—" },
      ]
    : [];

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/particulars"
            className="text-sm font-medium text-[var(--text-tertiary)] underline-offset-4 hover:underline"
          >
            ← Back to particulars
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            <Identifier>{detail.vesselName}</Identifier>
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Current ship particulars
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ParticularsVesselActions
            vesselId={vesselId}
            vessels={vessels}
            current={current}
          />
          {current ? (
            <ConfirmDeleteButton
              id={current.id}
              title="Delete current particulars?"
              description="Removes this record and its attachments. History rows are kept."
              action={deleteParticularsFormAction}
            />
          ) : null}
        </div>
      </div>

      {!current ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-[var(--text-muted)] dark:border-zinc-700">
          No current particulars for this vessel yet.
        </p>
      ) : (
        <>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  {f.label}
                </dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Attachments
            </h2>
            <div className="mt-4">
              <ParticularsAttachments
                particularsId={current.id}
                vesselId={vesselId}
                attachments={current.attachments}
              />
            </div>
          </section>
        </>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          History
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Past records (read-only). Use &quot;Add new current record&quot; to
          supersede without losing history.
        </p>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">No historical records.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-[var(--text-muted)] dark:border-zinc-800 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Effective</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">DWT</th>
                  <th className="px-4 py-3 font-medium">LOA</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {history.map((r) => (
                  <tr key={r.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-3 text-[var(--text-tertiary)]">
                      {r.effectiveDate ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-tertiary)]">
                      {r.classSociety ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-tertiary)]">
                      {r.deadweightTonnage ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-tertiary)]">
                      {r.lengthOverall ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-tertiary)]">
                      {r.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
