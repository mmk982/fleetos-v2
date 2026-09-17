/**
 * GET /api/export/drawings?format=xlsx|pdf&vesselId&categoryId
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
import { listDrawings } from "@/modules/drawings/drawing.controller";

type Row = {
  name: string;
  vessel: string;
  category: string;
  revision: string;
};

const COLUMNS: ExportColumn<Row>[] = [
  { key: "name", header: "Name" },
  { key: "vessel", header: "Vessel" },
  { key: "category", header: "Category" },
  { key: "revision", header: "Revision" },
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

  const access = toAccessContext(session);
  try {
    const rows = await listDrawings(access, {
      vesselId: url.searchParams.get("vesselId") || undefined,
      categoryId: url.searchParams.get("categoryId") || undefined,
    });

    const exportRows: Row[] = rows.map((row) => ({
      name: row.drawingName,
      vessel: row.vesselName,
      category: row.categoryName,
      revision: row.revision ?? "",
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Drawings")
        : await exportToPdf(exportRows, COLUMNS, "Drawings export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "drawing",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} drawing(s) as ${format}`,
    });

    return exportDownloadResponse(buffer, "drawings", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
