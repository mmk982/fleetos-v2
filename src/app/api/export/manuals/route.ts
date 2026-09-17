/**
 * GET /api/export/manuals?format=xlsx|pdf&vesselId&manualType&department
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
import { listManuals } from "@/modules/manuals/manual.controller";

type Row = {
  title: string;
  vessel: string;
  type: string;
  currentRevision: string;
};

const COLUMNS: ExportColumn<Row>[] = [
  { key: "title", header: "Title" },
  { key: "vessel", header: "Vessel" },
  { key: "type", header: "Type" },
  { key: "currentRevision", header: "Current revision" },
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
    assertModuleAccess(access, "export", "write");
    assertModuleAccess(access, "manuals", "read");

    const vesselId =
      access.role === "management_user"
        ? (access.vesselId ?? undefined)
        : url.searchParams.get("vesselId") || undefined;

    const rows = await listManuals(access, {
      vesselId,
      manualType: url.searchParams.get("manualType") || undefined,
      department: url.searchParams.get("department") || undefined,
    });

    const exportRows: Row[] = rows.map((row) => ({
      title: row.title,
      vessel: row.vesselName,
      type: row.manualType ?? "",
      currentRevision: row.currentRevision
        ? `Rev ${row.currentRevision.revisionNumber} — ${row.currentRevision.revisionDate}`
        : "—",
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Manuals")
        : await exportToPdf(exportRows, COLUMNS, "Manuals export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "manual",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} manual(s) as ${format}`,
    });

    return exportDownloadResponse(buffer, "manuals", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
