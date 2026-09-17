/**
 * GET /api/export/deficiencies?format=xlsx|pdf&vesselId&status&source&category
 * Session-authenticated list export with activity_logs audit row.
 */
import { NextResponse } from "next/server";
import type { DeficiencyStatus } from "@/db/schema";
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
import { listDeficiencies } from "@/modules/deficiencies/deficiency.controller";
import {
  DEFICIENCY_SOURCES,
  DEFICIENCY_STATUSES,
  deficiencySourceLabel,
  deficiencyStatusLabel,
} from "@/modules/deficiencies/deficiency.model";

type DefExportRow = {
  vessel: string;
  number: string;
  title: string;
  source: string;
  status: string;
  dueDate: string;
};

const COLUMNS: ExportColumn<DefExportRow>[] = [
  { key: "vessel", header: "Vessel" },
  { key: "number", header: "Deficiency Number" },
  { key: "title", header: "Title" },
  { key: "source", header: "Source" },
  { key: "status", header: "Status" },
  { key: "dueDate", header: "Due Date" },
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
  const status = DEFICIENCY_STATUSES.includes(statusRaw as DeficiencyStatus)
    ? (statusRaw as DeficiencyStatus)
    : undefined;

  const sourceRaw = url.searchParams.get("source") ?? "";
  const source = (DEFICIENCY_SOURCES as readonly string[]).includes(sourceRaw)
    ? sourceRaw
    : undefined;

  const access = toAccessContext(session);

  try {
    assertModuleAccess(access, "export", "write");
    assertModuleAccess(access, "deficiencies", "read");

    const vesselId =
      access.role === "management_user"
        ? (access.vesselId ?? undefined)
        : url.searchParams.get("vesselId") || undefined;

    const rows = await listDeficiencies(access, {
      vesselId,
      status,
      source,
      category: url.searchParams.get("category") || undefined,
    });

    const exportRows: DefExportRow[] = rows.map((row) => ({
      vessel: row.vesselName,
      number: row.deficiencyNumber ?? "",
      title: row.title,
      source: deficiencySourceLabel(row.source),
      status: deficiencyStatusLabel(row.status),
      dueDate: row.dueDate ?? "",
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Deficiencies")
        : await exportToPdf(exportRows, COLUMNS, "Deficiencies export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "deficiency",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} deficienc${exportRows.length === 1 ? "y" : "ies"} as ${format}`,
    });

    return exportDownloadResponse(buffer, "deficiencies", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
