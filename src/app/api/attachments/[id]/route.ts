/**
 * Authenticated attachment download (SECURITY_PLAN.md §6).
 *
 * Looks up the attachment row by id, streams the file from the path stored
 * in the database — never from anything user-supplied. Reference route for
 * every later module's attachments (currently certificate_attachments).
 */
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  AttachmentNotFoundError,
  openAttachmentStream,
} from "@/modules/certificates/certificate.controller";

type RouteContext = { params: Promise<{ id: string }> };

function contentTypeForPath(filePath: string, fileName: string): string {
  const lower = (filePath || fileName).toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const { row, stream } = await openAttachmentStream(
      toAccessContext(session),
      id,
    );
    const webStream = Readable.toWeb(
      stream as import("node:stream").Readable,
    ) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForPath(row.filePath, row.fileName),
        "Content-Disposition": `inline; filename="${row.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AttachmentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
