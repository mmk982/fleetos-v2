/**
 * GET /api/export/insurance?format=xlsx|pdf&vesselId&policyType
 */
import { NextResponse } from "next/server";
import type { InsuranceType } from "@/db/schema";
import {
  assertModuleAccess,
  ForbiddenError,
  toAccessContext,
} from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import { writeActivityLog } from "@/lib/activity-log/write";
import { STATUS_LABELS } from "@/lib/expiry";
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
import { listInsurancePolicies } from "@/modules/insurance/insurance.controller";
import {
  INSURANCE_TYPES,
  insuranceTypeLabel,
} from "@/modules/insurance/insurance.model";

type Row = {
  vessel: string;
  type: string;
  provider: string;
  expiry: string;
  status: string;
};

const COLUMNS: ExportColumn<Row>[] = [
  { key: "vessel", header: "Vessel" },
  { key: "type", header: "Type" },
  { key: "provider", header: "Provider" },
  { key: "expiry", header: "Expiry" },
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

  const policyTypeRaw = url.searchParams.get("policyType") ?? "";
  const policyType = INSURANCE_TYPES.includes(policyTypeRaw as InsuranceType)
    ? (policyTypeRaw as InsuranceType)
    : undefined;

  const access = toAccessContext(session);
  try {
    assertModuleAccess(access, "export", "write");
    assertModuleAccess(access, "insurance", "read");

    const vesselId =
      access.role === "management_user"
        ? (access.vesselId ?? undefined)
        : url.searchParams.get("vesselId") || undefined;

    const rows = await listInsurancePolicies(access, {
      vesselId,
      policyType,
    });

    const exportRows: Row[] = rows.map((row) => ({
      vessel: row.vesselName,
      type: insuranceTypeLabel(row.policyType),
      provider: row.provider ?? "",
      expiry: row.expiryDate ?? "",
      status: STATUS_LABELS[row.compliance.status],
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Insurance")
        : await exportToPdf(exportRows, COLUMNS, "Insurance export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "insurance",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} insurance polic${exportRows.length === 1 ? "y" : "ies"} as ${format}`,
    });

    return exportDownloadResponse(buffer, "insurance", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
