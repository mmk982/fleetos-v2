/**
 * GET /api/export/ism-templates?format=xlsx|pdf&categoryId&status
 */
import { NextResponse } from "next/server";
import type { IsmTemplateStatus } from "@/db/schema";
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
import { listIsmTemplates } from "@/modules/ism-templates/ismTemplate.controller";
import {
  ISM_TEMPLATE_STATUSES,
  ismTemplateStatusLabel,
} from "@/modules/ism-templates/ismTemplate.model";

type Row = {
  code: string;
  name: string;
  category: string;
  status: string;
};

const COLUMNS: ExportColumn<Row>[] = [
  { key: "code", header: "Code" },
  { key: "name", header: "Name" },
  { key: "category", header: "Category" },
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
  const status = ISM_TEMPLATE_STATUSES.includes(statusRaw as IsmTemplateStatus)
    ? (statusRaw as IsmTemplateStatus)
    : undefined;

  const access = toAccessContext(session);
  try {
    const rows = await listIsmTemplates(access, {
      categoryId: url.searchParams.get("categoryId") || undefined,
      status,
    });

    const exportRows: Row[] = rows.map((row) => ({
      code: row.formCode,
      name: row.formName,
      category: row.categoryName,
      status: ismTemplateStatusLabel(row.status),
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "ISM Templates")
        : await exportToPdf(exportRows, COLUMNS, "ISM Templates export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "ism_template",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} ISM template(s) as ${format}`,
    });

    return exportDownloadResponse(buffer, "ism-templates", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
