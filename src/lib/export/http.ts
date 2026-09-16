/**
 * Shared helpers for `/api/export/*` Route Handlers.
 */
import { NextResponse } from "next/server";

/**
 * Sentinel `activity_logs.recordId` for bulk list exports (not a single row).
 * Nil UUID — flagged for product confirmation; replace if a different
 * convention is chosen.
 */
export const BULK_EXPORT_RECORD_ID =
  "00000000-0000-0000-0000-000000000000" as const;

export type ExportFormat = "xlsx" | "pdf";

export function parseExportFormat(
  raw: string | null,
): ExportFormat | null {
  if (raw === "xlsx" || raw === "pdf") return raw;
  return null;
}

export function exportContentType(format: ExportFormat): string {
  return format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/pdf";
}

export function exportFilename(moduleSlug: string, format: ExportFormat): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${moduleSlug}-export-${day}.${format}`;
}

export function exportDownloadResponse(
  body: Buffer,
  moduleSlug: string,
  format: ExportFormat,
): NextResponse {
  const filename = exportFilename(moduleSlug, format);
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": exportContentType(format),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function buildExportQuery(
  filters: Record<string, string | undefined>,
  format: ExportFormat,
): string {
  const params = new URLSearchParams();
  params.set("format", format);
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}
