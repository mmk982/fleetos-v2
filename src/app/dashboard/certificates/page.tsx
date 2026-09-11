import Link from "next/link";
import {
  listCertificates,
  listIssuingAuthorities,
} from "@/modules/certificates/certificate.controller";
import {
  CERTIFICATE_AUTHORITIES,
  complianceLabel,
  complianceStyle,
  formatAuthority,
} from "@/modules/certificates/certificate.model";
import { listVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import type { ComplianceStatus } from "@/lib/expiry";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  vesselId?: string;
  authority?: string;
  issuingAuthorityId?: string;
  status?: string;
}>;

const STATUS_FILTERS: ComplianceStatus[] = [
  "valid",
  "expiring",
  "critical",
  "expired",
  "unknown",
  "revoked",
];

export default async function CertificatesPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const sp = await props.searchParams;

  const status = STATUS_FILTERS.includes(sp.status as ComplianceStatus)
    ? (sp.status as ComplianceStatus)
    : undefined;

  const [rows, vessels, issuers] = await Promise.all([
    listCertificates(access, {
      vesselId: sp.vesselId || undefined,
      authority: sp.authority || undefined,
      issuingAuthorityId: sp.issuingAuthorityId || undefined,
      status,
    }),
    listVessels(access),
    listIssuingAuthorities(access),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Certificates
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Vessel compliance certificates with live expiry status.
          </p>
        </div>
        <Link
          href="/dashboard/certificates/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Add certificate
        </Link>
      </div>

      <form
        method="get"
        className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Vessel
          <select
            name="vesselId"
            defaultValue={sp.vesselId ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">All</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Authority
          <select
            name="authority"
            defaultValue={sp.authority ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">All</option>
            {CERTIFICATE_AUTHORITIES.map((a) => (
              <option key={a} value={a}>
                {formatAuthority(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Issuing authority
          <select
            name="issuingAuthorityId"
            defaultValue={sp.issuingAuthorityId ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">All</option>
            {issuers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Status
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">All</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {complianceLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-600 dark:text-zinc-400">
            No certificates match.{" "}
            <Link
              href="/dashboard/certificates/new"
              className="font-medium text-[#378ADD] underline-offset-4 hover:underline"
            >
              Create one
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Vessel</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Authority</th>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Issuer</th>
                  <th className="px-4 py-3">Expiry / window</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((row) => {
                  const dateRef =
                    row.ruleKind === "window"
                      ? (row.windowOpenDate ?? "—")
                      : (row.expiryDate ?? "—");
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                        {row.vesselName}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        <Link
                          href={`/dashboard/certificates/${row.id}`}
                          className="text-[#378ADD] hover:underline"
                        >
                          {row.typeName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">
                        {row.authority}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                        {row.certificateNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {row.issuingAuthorityName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {dateRef}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs ${complianceStyle(row.compliance.status)}`}
                        >
                          {complianceLabel(row.compliance.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/certificates/${row.id}/edit`}
                          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
