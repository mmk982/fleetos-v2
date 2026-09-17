/**
 * GET /api/export/crew?format=xlsx|pdf&vesselId&status&categoryId
 *
 * GDPR-scoped: writes access_logs (accessType: export) per exported member,
 * not a bulk activity_logs sentinel.
 */
import { NextResponse } from "next/server";
import type { CrewStatus } from "@/db/schema";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import { writeAccessLog } from "@/lib/access-log/write";
import {
  exportToExcel,
  exportToPdf,
  type ExportColumn,
} from "@/lib/export";
import {
  exportDownloadResponse,
  parseExportFormat,
} from "@/lib/export/http";
import { listCrewMembers } from "@/modules/crew/crew.controller";
import {
  CREW_STATUSES,
  crewMemberDisplayName,
  crewMemberStatusLabel,
} from "@/modules/crew/crew.model";

type Row = {
  name: string;
  category: string;
  vessel: string;
  status: string;
};

const COLUMNS: ExportColumn<Row>[] = [
  { key: "name", header: "Name" },
  { key: "category", header: "Category" },
  { key: "vessel", header: "Vessel" },
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
  const status = CREW_STATUSES.includes(statusRaw as CrewStatus)
    ? (statusRaw as CrewStatus)
    : undefined;

  const access = toAccessContext(session);
  try {
    const rows = await listCrewMembers(access, {
      vesselId: url.searchParams.get("vesselId") || undefined,
      status,
      categoryId: url.searchParams.get("categoryId") || undefined,
    });

    const exportRows: Row[] = rows.map((row) => ({
      name: crewMemberDisplayName(row),
      category: row.categoryName ?? "—",
      vessel: row.vesselName ?? "—",
      status: crewMemberStatusLabel(row.status),
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Crew")
        : await exportToPdf(exportRows, COLUMNS, "Crew export");

    for (const row of rows) {
      await writeAccessLog({
        userId: access.userId,
        moduleName: "crew",
        recordId: row.id,
        accessType: "export",
      });
    }

    return exportDownloadResponse(buffer, "crew", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
