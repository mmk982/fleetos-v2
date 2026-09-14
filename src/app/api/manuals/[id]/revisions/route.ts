import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  addManualRevision,
  AttachmentValidationError,
  getManualById,
  ManualNotFoundError,
} from "@/modules/manuals/manual.controller";
import { manualRevisionCreateSchema } from "@/modules/manuals/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const detail = await getManualById(toAccessContext(session), id);
  if (!detail) {
    return NextResponse.json({ error: "Manual not found" }, { status: 404 });
  }
  return NextResponse.json({ data: detail.revisions });
}

/** POST multipart: revision fields + `file`. */
export async function POST(request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);
  const { id: manualId } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data" },
      { status: 400 },
    );
  }

  const parsed = manualRevisionCreateSchema.safeParse({
    manualId,
    revisionNumber: formData.get("revisionNumber")?.toString(),
    revisionDate: formData.get("revisionDate")?.toString(),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const data = await addManualRevision(
      access,
      manualId,
      {
        revisionNumber: parsed.data.revisionNumber,
        revisionDate: parsed.data.revisionDate,
      },
      {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        bytes,
      },
    );
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ManualNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
