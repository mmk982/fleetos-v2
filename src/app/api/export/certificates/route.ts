/**
 * GET /api/export/certificates?format=xlsx|pdf&vesselId&authority&…
 * Session-authenticated list export with activity_logs audit row.
 */
import { NextResponse } from "next/server";
import {
  assertModuleAccess,
  ForbiddenError,
  toAccessContext,
} from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import { writeActivityLog } from "@/lib/activity-log/write";
import { STATUS_LABELS, type ComplianceStatus } from "@/lib/expiry";
import {
  exportToExcel,
  exportToPdf,
  type ExportColumn,
} from "@/lib/export";
import {
  BULK_EXPORT_RECORD_ID,
  exportDownloadResponse,
  parseExportFormat,
} from "@/lib/export/http";
import { listCertificates } from "@/modules/certificates/certificate.controller";
import {
  CERTIFICATE_AUTHORITIES,
  type CertificateAuthority,
} from "@/modules/certificates/certificate.model";

const STATUS_FILTERS: ComplianceStatus[] = [
  "valid",
  "expiring",
  "critical",
  "expired",
  "unknown",
  "revoked",
];

type CertExportRow = {
  vessel: string;
  type: string;
  number: string;
  issuer: string;
  expiry: string;
  status: string;
};

const COLUMNS: ExportColumn<CertExportRow>[] = [
  { key: "vessel", header: "Vessel" },
  { key: "type", header: "Certificate Type" },
  { key: "number", header: "Certificate Number" },
  { key: "issuer", header: "Issuing Authority" },
  { key: "expiry", header: "Expiry Date" },
  { key: "status", header: "Status" },
];

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = parseExportFormat(url.searchParams.get("format"));
  if (!format) {
    return NextResponse.json(
      { error: "Query format must be xlsx or pdf." },
      { status: 400 },
    );
  }

  const statusRaw = url.searchParams.get("status") ?? "";
  const status = STATUS_FILTERS.includes(statusRaw as ComplianceStatus)
    ? (statusRaw as ComplianceStatus)
    : undefined;

  const authorityRaw = url.searchParams.get("authority") ?? "";
  const authority = (CERTIFICATE_AUTHORITIES as readonly string[]).includes(
    authorityRaw,
  )
    ? (authorityRaw as CertificateAuthority)
    : undefined;

  const access = toAccessContext(session);

  try {
    assertModuleAccess(access, "export", "write");
    assertModuleAccess(access, "certificates", "read");

    const vesselId =
      access.role === "management_user"
        ? (access.vesselId ?? undefined)
        : url.searchParams.get("vesselId") || undefined;

    const rows = await listCertificates(access, {
      vesselId,
      authority,
      issuingAuthorityId:
        url.searchParams.get("issuingAuthorityId") || undefined,
      status,
    });

    const exportRows: CertExportRow[] = rows.map((row) => ({
      vessel: row.vesselName,
      type: row.typeName,
      number: row.certificateNumber ?? "",
      issuer: row.issuingAuthorityName ?? "",
      expiry: row.expiryDate ?? "",
      status: STATUS_LABELS[row.compliance.status],
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Certificates")
        : await exportToPdf(exportRows, COLUMNS, "Certificates export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "certificate",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} certificate(s) as ${format}`,
    });

    return exportDownloadResponse(buffer, "certificates", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
