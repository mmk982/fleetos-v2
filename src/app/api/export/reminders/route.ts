/**
 * GET /api/export/reminders?format=xlsx|pdf&vesselId&type&priority&status
 */
import { NextResponse } from "next/server";
import type {
  ReminderPriority,
  ReminderStatus,
  ReminderType,
} from "@/db/schema";
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
import { listReminders } from "@/modules/reminders/reminder.controller";
import {
  REMINDER_PRIORITIES,
  REMINDER_STATUSES,
  REMINDER_TYPES,
  reminderPriorityLabel,
  reminderStatusLabel,
  reminderTypeLabel,
  type ReminderListItem,
} from "@/modules/reminders/reminder.model";

type Row = {
  title: string;
  vessel: string;
  type: string;
  date: string;
  priority: string;
  status: string;
  related: string;
};

const COLUMNS: ExportColumn<Row>[] = [
  { key: "title", header: "Title" },
  { key: "vessel", header: "Vessel" },
  { key: "type", header: "Type" },
  { key: "date", header: "Date" },
  { key: "priority", header: "Priority" },
  { key: "status", header: "Status" },
  { key: "related", header: "Related" },
];

function relatedLabel(row: ReminderListItem): string {
  if (!row.relatedItemKind && !row.relatedItemId) return "—";
  const kind = row.relatedItemKind ?? "item";
  const id = row.relatedItemId ? ` · ${row.relatedItemId.slice(0, 8)}…` : "";
  return `${kind}${id}`;
}

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

  const typeRaw = url.searchParams.get("type") ?? "";
  const type = REMINDER_TYPES.includes(typeRaw as ReminderType)
    ? (typeRaw as ReminderType)
    : undefined;
  const priorityRaw = url.searchParams.get("priority") ?? "";
  const priority = REMINDER_PRIORITIES.includes(priorityRaw as ReminderPriority)
    ? (priorityRaw as ReminderPriority)
    : undefined;
  const statusRaw = url.searchParams.get("status") ?? "";
  const status = REMINDER_STATUSES.includes(statusRaw as ReminderStatus)
    ? (statusRaw as ReminderStatus)
    : undefined;

  const access = toAccessContext(session);
  try {
    assertModuleAccess(access, "export", "write");
    assertModuleAccess(access, "reminders", "read");

    const vesselId =
      access.role === "management_user"
        ? (access.vesselId ?? undefined)
        : url.searchParams.get("vesselId") || undefined;

    const rows = await listReminders(access, {
      vesselId,
      type,
      priority,
      status,
    });

    const exportRows: Row[] = rows.map((row) => ({
      title: row.title,
      vessel: row.vesselName ?? "—",
      type: reminderTypeLabel(row.type),
      date: row.reminderDate,
      priority: reminderPriorityLabel(row.priority),
      status: reminderStatusLabel(row.status),
      related: relatedLabel(row),
    }));

    const buffer =
      format === "xlsx"
        ? await exportToExcel(exportRows, COLUMNS, "Reminders")
        : await exportToPdf(exportRows, COLUMNS, "Reminders export");

    await writeActivityLog({
      userId: access.userId,
      actionType: "exported",
      moduleName: "reminder",
      recordId: BULK_EXPORT_RECORD_ID,
      description: `Exported ${exportRows.length} reminder(s) as ${format}`,
    });

    return exportDownloadResponse(buffer, "reminders", format);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
