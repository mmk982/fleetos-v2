/**
 * Shared Excel/PDF formatters for list exports.
 * Pure buffers only — auth, DB, and audit logging stay in route handlers.
 * Spec: PROJECT_PLAN.md build-order step 15.
 */
import "server-only";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export type ExportColumn<T> = { key: keyof T & string; header: string };

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Build a single-sheet `.xlsx` workbook as a Buffer.
 */
export async function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Export");

  sheet.columns = columns.map((col) => {
    let maxLen = col.header.length;
    for (const row of rows) {
      const len = cellText(row[col.key]).length;
      if (len > maxLen) maxLen = len;
    }
    return {
      header: col.header,
      key: col.key,
      width: Math.min(Math.max(maxLen + 2, 10), 60),
    };
  });

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  for (const row of rows) {
    const values: Record<string, string> = {};
    for (const col of columns) {
      values[col.key] = cellText(row[col.key]);
    }
    sheet.addRow(values);
  }

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

/**
 * Build a simple multi-page tabular PDF as a Buffer.
 */
export async function exportToPdf<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  title: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      autoFirstPage: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / Math.max(columns.length, 1);
    const rowHeight = 16;
    const bottom = doc.page.height - doc.page.margins.bottom;

    doc.fontSize(14).font("Helvetica-Bold").text(title, { underline: false });
    doc.moveDown(0.75);

    function ensureSpace(needed: number) {
      if (doc.y + needed > bottom) {
        doc.addPage();
      }
    }

    function drawHeader() {
      ensureSpace(rowHeight + 4);
      const y = doc.y;
      doc.fontSize(9).font("Helvetica-Bold");
      columns.forEach((col, i) => {
        doc.text(col.header, doc.page.margins.left + i * colWidth, y, {
          width: colWidth - 4,
          lineBreak: false,
        });
      });
      doc.y = y + rowHeight;
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + pageWidth, doc.y)
        .strokeColor("#cccccc")
        .stroke();
      doc.moveDown(0.3);
    }

    drawHeader();
    doc.font("Helvetica").fontSize(8);

    for (const row of rows) {
      ensureSpace(rowHeight);
      // Re-draw header after a page break.
      if (doc.y <= doc.page.margins.top + 2) {
        drawHeader();
        doc.font("Helvetica").fontSize(8);
      }
      const y = doc.y;
      columns.forEach((col, i) => {
        doc.text(cellText(row[col.key]), doc.page.margins.left + i * colWidth, y, {
          width: colWidth - 4,
          lineBreak: false,
          ellipsis: true,
        });
      });
      doc.y = y + rowHeight;
    }

    if (rows.length === 0) {
      doc.font("Helvetica").fontSize(10).text("No rows to export.");
    }

    doc.end();
  });
}
