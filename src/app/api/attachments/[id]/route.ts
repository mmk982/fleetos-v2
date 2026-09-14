/**
 * Authenticated attachment download (SECURITY_PLAN.md §6).
 *
 * Generic across modules: looks up `certificate_attachments`, then
 * `deficiency_attachments` (see `src/lib/attachments/resolve.ts` for why
 * this stays one route rather than per-module URLs). Path is taken only
 * from the DB row — never from the request.
 */
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import {
  AttachmentNotFoundError,
  resolveAttachmentStream,
} from "@/lib/attachments/resolve";
import { contentTypeForAttachment } from "@/lib/attachments/stream";
import { validateSession } from "@/lib/auth/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const { fileName, filePath, stream } = await resolveAttachmentStream(
      toAccessContext(session),
      id,
    );
    const webStream = Readable.toWeb(
      stream as import("node:stream").Readable,
    ) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForAttachment(filePath, fileName),
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
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
    // Path-escape from openStoredAttachmentStream surfaces as generic Error.
    if (error instanceof Error && error.message === "Attachment path rejected") {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    throw error;
  }
}
