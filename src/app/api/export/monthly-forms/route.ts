/**
 * GET /api/export/monthly-forms?format=xlsx|pdf&vesselId&month&year&status
 */
import { NextResponse } from "next/server";
import type { MonthlyFormStatus } from "@/db/schema";
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
import { listMonthlyForms } from "@/modules/monthly-forms/monthlyForm.controller";
import {
  MONTHLY_FORM_STATUSES,
  monthlyFormDisplayStatusLabel,
} from "@/modules/monthly-forms/monthlyForm.model";

type Row = {
  form: string;
  vessel: string;
  period: string;
  status: string;
  files: string;
};

const COLUMNS: ExportColumn<Row>[] = [
  { key: "form", header: "Form" },
  { key: "vessel", header: "Vessel" },
  { key: "period", header: "Period" },
  { key: "status", header: "Status" },
  { key: "files", header: "Files" },
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

  const monthRaw = url.searchParams.get("month");
  const yearRaw = url.searchParams.get("year");
  const month = monthRaw ? Number(monthRaw) : undefined;
  const year = yearRaw ? Number(yearRaw) : undefined;
  const statusRaw = url.searchParams.get("status") ?? "";
  const status = (MONTHLY_FORM_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as MonthlyFormStatus)
    : undefined;

  const access = toAccessContext(session);
  try {
    assertModuleAccess(access, "export", "write");
    assertModuleAccess(access, "monthly_forms", "read");

    const vesselId =
      access.role === "management_user"
        ? (access.vesselId ?? undefined)
        : url.searchParams.get("vesselId") || undefined;

    const rows = await listMonthlyForms(access, {
      vesselId,
      month: Number.isFinite(month) ? month : undefined,
      year: Number.isFinite(year) ? year : undefined,
      status,
    });

    const exportRows: Row[] = rows.map((row) => ({
      form: row.formName,
      vessel: row.vesselName,
      period: `${row.month}/${row.year}`,
      status: monthlyFormDisplayStatusLabel(row.displayStatus),
      files: String(row.attachmentCount),
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Monthly Forms")
        : await exportToPdf(exportRows, COLUMNS, "Monthly Forms export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "monthly_form",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} monthly form(s) as ${format}`,
    });

    return exportDownloadResponse(buffer, "monthly-forms", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
