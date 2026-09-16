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
import { VesselNoteForm } from "@/components/vessel-note-form";
import {
  parseVesselTab,
  VesselTabsNav,
  type VesselTabKey,
} from "@/components/vessel-tabs-nav";
import type { VesselParticularsRow, VesselRow } from "@/db/schema";
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
import { listDrawings } from "@/modules/drawings/drawing.controller";
import type { DrawingListItem } from "@/modules/drawings/drawing.model";
import { listInsurancePolicies } from "@/modules/insurance/insurance.controller";
import type { InsuranceListItem } from "@/modules/insurance/insurance.model";
import { listIsmTemplates } from "@/modules/ism-templates/ismTemplate.controller";
import {
  ismTemplateStatusLabel,
  ismTemplateStatusTone,
  type IsmTemplateListItem,
} from "@/modules/ism-templates/ismTemplate.model";
import { listManuals } from "@/modules/manuals/manual.controller";
import type { ManualListItem } from "@/modules/manuals/manual.model";
import { listMonthlyForms } from "@/modules/monthly-forms/monthlyForm.controller";
import {
  monthlyFormDisplayStatusLabel,
  monthlyFormDisplayStatusTone,
  type MonthlyFormListItem,
} from "@/modules/monthly-forms/monthlyForm.model";
import {
  deleteVesselNoteFormAction,
} from "@/modules/ship-particulars/actions";
import { getParticularsForVessel } from "@/modules/ship-particulars/particulars.controller";
import type { ParticularsCurrentDetail } from "@/modules/ship-particulars/particulars.model";
import {
  listVesselNotes,
  type VesselNoteListItem,
} from "@/modules/ship-particulars/vessel-notes.controller";
import { deleteVesselFormAction } from "@/modules/vessels/actions";
import { getVesselById } from "@/modules/vessels/vessel.controller";
import { formatImo, vesselStatusTone } from "@/modules/vessels/vessel.model";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function VesselDetailPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;
  const sp = await props.searchParams;
  const active: VesselTabKey = parseVesselTab(sp.tab);

  const vessel = await getVesselById(access, id);
  if (!vessel) notFound();

  const [
    certificates,
    manuals,
    ismTemplates,
    executedForms,
    drawings,
    particulars,
    insurance,
    deficiencies,
    notes,
  ] = await Promise.all([
    active === "certificates"
      ? listCertificates(access, { vesselId: id })
      : null,
    active === "manuals" ? listManuals(access, { vesselId: id }) : null,
    active === "ism" ? listIsmTemplates(access) : null,
    active === "executed"
      ? listMonthlyForms(access, { vesselId: id })
      : null,
    active === "drawings" ? listDrawings(access, { vesselId: id }) : null,
    active === "particulars" ? getParticularsForVessel(access, id) : null,
    active === "insurance"
      ? listInsurancePolicies(access, { vesselId: id })
      : null,
    active === "deficiencies"
      ? listDeficiencies(access, { vesselId: id })
      : null,
    active === "notes" ? listVesselNotes(access, id) : null,
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

      <VesselTabsNav vesselId={vessel.id} active={active} />

      <div className="mt-6">
        {active === "general" ? <GeneralInfoPanel vessel={vessel} /> : null}
        {active === "certificates" && certificates ? (
          <CertificatesPanel vesselId={id} rows={certificates} />
        ) : null}
        {active === "manuals" && manuals ? (
          <ManualsPanel vesselId={id} rows={manuals} />
        ) : null}
        {active === "ism" && ismTemplates ? (
          <IsmFormsPanel rows={ismTemplates} />
        ) : null}
        {active === "executed" && executedForms ? (
          <ExecutedFormsPanel vesselId={id} rows={executedForms} />
        ) : null}
        {active === "drawings" && drawings ? (
          <DrawingsPanel vesselId={id} rows={drawings} />
        ) : null}
        {active === "particulars" && particulars !== null ? (
          <ParticularsPanel
            vesselId={id}
            current={particulars?.current ?? null}
            history={(particulars?.history ?? []).filter((r) => !r.isCurrent)}
          />
        ) : null}
        {active === "insurance" && insurance ? (
          <InsurancePanel vesselId={id} rows={insurance} />
        ) : null}
        {active === "deficiencies" && deficiencies ? (
          <DeficienciesPanel vesselId={id} rows={deficiencies} />
        ) : null}
        {active === "notes" && notes ? (
          <NotesPanel vesselId={id} rows={notes} />
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

function PanelHeader({ title, href }: { title: string; href: string }) {
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

function IsmFormsPanel({ rows }: { rows: IsmTemplateListItem[] }) {
  return (
    <section>
      <PanelHeader title="ISM Forms" href="/dashboard/ism-templates" />
      <p className="mb-3 text-sm text-zinc-500">
        Fleet-wide templates (not vessel-scoped).
      </p>
      {rows.length === 0 ? (
        <EmptyHint>No ISM templates yet.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/ism-templates/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      <Identifier>{row.formCode}</Identifier>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.formName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.categoryName}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={ismTemplateStatusTone(row.status)}>
                      {ismTemplateStatusLabel(row.status)}
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

function ExecutedFormsPanel({
  vesselId,
  rows,
}: {
  vesselId: string;
  rows: MonthlyFormListItem[];
}) {
  return (
    <section>
      <PanelHeader
        title="Executed Forms"
        href={`/dashboard/monthly-forms?vesselId=${vesselId}`}
      />
      {rows.length === 0 ? (
        <EmptyHint>No executed forms for this vessel.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Form</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/monthly-forms/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {row.formName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {row.month}/{row.year}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      tone={monthlyFormDisplayStatusTone(row.displayStatus)}
                    >
                      {monthlyFormDisplayStatusLabel(row.displayStatus)}
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

function DrawingsPanel({
  vesselId,
  rows,
}: {
  vesselId: string;
  rows: DrawingListItem[];
}) {
  return (
    <section>
      <PanelHeader
        title="Drawings"
        href={`/dashboard/drawings?vesselId=${vesselId}`}
      />
      {rows.length === 0 ? (
        <EmptyHint>No drawings for this vessel.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Rev</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/drawings/${row.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {row.drawingName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    <Identifier>{row.drawingNumber ?? "—"}</Identifier>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.categoryName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.revision ?? "—"}
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

function ParticularsPanel({
  vesselId,
  current,
  history,
}: {
  vesselId: string;
  current: ParticularsCurrentDetail | null;
  history: VesselParticularsRow[];
}) {
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
        { label: "Effective date", value: current.effectiveDate ?? "—" },
      ]
    : [];

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Current particulars
        </h2>
        <Link
          href={`/dashboard/particulars/${vesselId}`}
          className="text-sm font-medium text-[#378ADD] hover:underline"
        >
          Manage particulars
        </Link>
      </div>

      {!current ? (
        <EmptyHint>No current particulars for this vessel.</EmptyHint>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {f.label}
                </dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Attachments
            </h3>
            {current.attachments.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No attachments.</p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {current.attachments.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <a
                      href={`/api/attachments/${a.id}`}
                      className="font-medium text-[#378ADD] hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Identifier>{a.fileName}</Identifier>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          History
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Past records (read-only).{" "}
          <Link
            href={`/dashboard/particulars/${vesselId}`}
            className="font-medium text-[#378ADD] hover:underline"
          >
            View full history
          </Link>
        </p>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No historical records.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Effective</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">DWT</th>
                  <th className="px-4 py-3 font-medium">LOA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {history.map((row) => (
                  <tr key={row.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {row.effectiveDate ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {row.classSociety ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {row.deadweightTonnage ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {row.lengthOverall ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

function NotesPanel({
  vesselId,
  rows,
}: {
  vesselId: string;
  rows: VesselNoteListItem[];
}) {
  return (
    <section className="max-w-3xl space-y-6">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Notes
      </h2>

      <VesselNoteForm vesselId={vesselId} />

      {rows.length === 0 ? (
        <EmptyHint>No notes yet.</EmptyHint>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map((note) => (
            <li
              key={note.id}
              className="flex flex-col gap-3 bg-white px-4 py-4 dark:bg-zinc-950 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-50">
                  {note.body}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {note.authorName ?? "System"} ·{" "}
                  <time dateTime={note.createdAt.toISOString()}>
                    {note.createdAt.toISOString()}
                  </time>
                </p>
              </div>
              <ConfirmDeleteButton
                id={note.id}
                label="Delete"
                title="Delete note?"
                description="This permanently removes the note. There is no undo."
                action={deleteVesselNoteFormAction}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
