/**
 * GET /api/export/vessels?format=xlsx|pdf
 */
import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
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
import { listVessels } from "@/modules/vessels/vessel.controller";
import { formatImo } from "@/modules/vessels/vessel.model";

type Row = {
  name: string;
  imo: string;
  flag: string;
  type: string;
  status: string;
};

const COLUMNS: ExportColumn<Row>[] = [
  { key: "name", header: "Name" },
  { key: "imo", header: "IMO" },
  { key: "flag", header: "Flag" },
  { key: "type", header: "Type" },
  { key: "status", header: "Status" },
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
    const vessels = await listVessels(access);
    const exportRows: Row[] = vessels.map((v) => ({
      name: v.name,
      imo: formatImo(v.imoNumber),
      flag: v.flagState ?? "",
      type: v.vesselType ?? "",
      status: v.status.charAt(0).toUpperCase() + v.status.slice(1),
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Vessels")
        : await exportToPdf(exportRows, COLUMNS, "Vessels export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "vessel",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} vessel(s) as ${format}`,
    });

    return exportDownloadResponse(buffer, "vessels", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
