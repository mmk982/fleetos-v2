/**
 * Vessel detail — tabbed assembly of existing module list APIs.
 * Spec: PROJECT_PLAN.md vessel-detail integration (no Crew tab).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import {
  parseVesselTab,
  VesselTabsNav,
  type VesselTabKey,
} from "@/components/vessel-tabs-nav";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import { listCertificates } from "@/modules/certificates/certificate.controller";
import type { CertificateListItem } from "@/modules/certificates/certificate.model";
import { listDeficiencies } from "@/modules/deficiencies/deficiency.controller";
import {
  deficiencyStatusLabel,
  deficiencyStatusTone,
  type DeficiencyListItem,
} from "@/modules/deficiencies/deficiency.model";
import { listInsurancePolicies } from "@/modules/insurance/insurance.controller";
import type { InsuranceListItem } from "@/modules/insurance/insurance.model";
import { listManuals } from "@/modules/manuals/manual.controller";
import type { ManualListItem } from "@/modules/manuals/manual.model";
import { deleteVesselFormAction } from "@/modules/vessels/actions";
import { getVesselById } from "@/modules/vessels/vessel.controller";
import { formatImo, vesselStatusTone } from "@/modules/vessels/vessel.model";
import type { VesselRow } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Commit 1 tabs — remaining five land in the follow-up commit. */
const COMMIT1_TABS = [
  "general",
  "certificates",
  "manuals",
  "insurance",
  "deficiencies",
] as const satisfies readonly VesselTabKey[];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function VesselDetailPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;
  const sp = await props.searchParams;
  const tab = parseVesselTab(sp.tab);
  const active: VesselTabKey = (COMMIT1_TABS as readonly string[]).includes(tab)
    ? tab
    : "general";

  const vessel = await getVesselById(access, id);
  if (!vessel) notFound();

  const [certificates, manuals, insurance, deficiencies] = await Promise.all([
    active === "certificates"
      ? listCertificates(access, { vesselId: id })
      : Promise.resolve(null),
    active === "manuals"
      ? listManuals(access, { vesselId: id })
      : Promise.resolve(null),
    active === "insurance"
      ? listInsurancePolicies(access, { vesselId: id })
      : Promise.resolve(null),
    active === "deficiencies"
      ? listDeficiencies(access, { vesselId: id })
      : Promise.resolve(null),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
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

      <VesselTabsNav vesselId={vessel.id} active={active} keys={COMMIT1_TABS} />

      <div className="mt-6">
        {active === "general" ? <GeneralInfoPanel vessel={vessel} /> : null}
        {active === "certificates" && certificates ? (
          <CertificatesPanel vesselId={id} rows={certificates} />
        ) : null}
        {active === "manuals" && manuals ? (
          <ManualsPanel vesselId={id} rows={manuals} />
        ) : null}
        {active === "insurance" && insurance ? (
          <InsurancePanel vesselId={id} rows={insurance} />
        ) : null}
        {active === "deficiencies" && deficiencies ? (
          <DeficienciesPanel vesselId={id} rows={deficiencies} />
        ) : null}
      </div>
    </main>
  );
}

function GeneralInfoPanel({ vessel }: { vessel: VesselRow }) {
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
    <dl className="grid max-w-3xl gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {row.label}
          </dt>
          <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PanelHeader({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <Link
        href={href}
        className="text-sm font-medium text-[#378ADD] hover:underline"
      >
        View all
      </Link>
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
      {children}
    </p>
  );
}

function CertificatesPanel({
  vesselId,
  rows,
}: {
  vesselId: string;
  rows: CertificateListItem[];
}) {
  return (
    <section>
      <PanelHeader
        title="Certificates"
        href={`/dashboard/certificates?vesselId=${vesselId}`}
      />
      {rows.length === 0 ? (
        <EmptyHint>No certificates for this vessel.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Expiry</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/certificates/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {row.typeName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {row.expiryDate ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.compliance.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ManualsPanel({
  vesselId,
  rows,
}: {
  vesselId: string;
  rows: ManualListItem[];
}) {
  return (
    <section>
      <PanelHeader
        title="Manuals"
        href={`/dashboard/manuals?vesselId=${vesselId}`}
      />
      {rows.length === 0 ? (
        <EmptyHint>No manuals for this vessel.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Current rev</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/manuals/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.manualType}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.currentRevision
                      ? `${row.currentRevision.revisionNumber} · ${row.currentRevision.revisionDate}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InsurancePanel({
  vesselId,
  rows,
}: {
  vesselId: string;
  rows: InsuranceListItem[];
}) {
  return (
    <section>
      <PanelHeader
        title="Insurance"
        href={`/dashboard/insurance?vesselId=${vesselId}`}
      />
      {rows.length === 0 ? (
        <EmptyHint>No insurance policies for this vessel.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Expiry</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/insurance/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {row.policyType}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.provider}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {row.expiryDate}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.compliance.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DeficienciesPanel({
  vesselId,
  rows,
}: {
  vesselId: string;
  rows: DeficiencyListItem[];
}) {
  return (
    <section>
      <PanelHeader
        title="Deficiencies"
        href={`/dashboard/deficiencies?vesselId=${vesselId}`}
      />
      {rows.length === 0 ? (
        <EmptyHint>No deficiencies for this vessel.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/deficiencies/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      <Identifier>{row.deficiencyNumber ?? "—"}</Identifier>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.title}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {row.dueDate ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={deficiencyStatusTone(row.status)}>
                      {deficiencyStatusLabel(row.status)}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
