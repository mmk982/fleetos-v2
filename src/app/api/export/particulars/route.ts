/**
 * GET /api/export/particulars?format=xlsx|pdf
 */
import { NextResponse } from "next/server";
import {
  assertModuleAccess,
  ForbiddenError,
  toAccessContext,
} from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import { writeActivityLog } from "@/lib/activity-log/write";
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
import { listVesselParticularsSummary } from "@/modules/ship-particulars/particulars.controller";

type Row = {
  vessel: string;
  classSociety: string;
  dwt: string;
  loa: string;
  effective: string;
};

const COLUMNS: ExportColumn<Row>[] = [
  { key: "vessel", header: "Vessel" },
  { key: "classSociety", header: "Class society" },
  { key: "dwt", header: "DWT" },
  { key: "loa", header: "LOA (m)" },
  { key: "effective", header: "Effective" },
];

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = parseExportFormat(new URL(request.url).searchParams.get("format"));
  if (!format) {
    return NextResponse.json(
      { error: "Query format must be xlsx or pdf." },
      { status: 400 },
    );
  }

  const access = toAccessContext(session);
  try {
    assertModuleAccess(access, "export", "write");
    assertModuleAccess(access, "particulars", "read");

    const rows = await listVesselParticularsSummary(access);
    const exportRows: Row[] = rows.map((row) => ({
      vessel: row.vesselName,
      classSociety: row.classSociety ?? "",
      dwt: row.deadweightTonnage != null ? String(row.deadweightTonnage) : "",
      loa: row.lengthOverall ?? "",
      effective: row.effectiveDate ?? "",
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Particulars")
        : await exportToPdf(exportRows, COLUMNS, "Particulars export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "particulars",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} particulars row(s) as ${format}`,
    });

    return exportDownloadResponse(buffer, "particulars", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
