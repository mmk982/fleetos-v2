import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  AttachmentValidationError,
  createManualWithFirstRevision,
  listManuals,
  ManualConflictError,
} from "@/modules/manuals/manual.controller";
import { manualCreateSchema } from "@/modules/manuals/validation";

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const data = await listManuals(toAccessContext(session), {
    vesselId: url.searchParams.get("vesselId") ?? undefined,
    manualType: url.searchParams.get("manualType") ?? undefined,
    department: url.searchParams.get("department") ?? undefined,
  });
  return NextResponse.json({ data });
}

/** POST multipart: manual fields + `file` for the first revision. */
export async function POST(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data" },
      { status: 400 },
    );
  }

  const parsed = manualCreateSchema.safeParse({
    vesselId: String(formData.get("vesselId") ?? ""),
    title: String(formData.get("title") ?? ""),
    manualType: formData.get("manualType")?.toString(),
    department: formData.get("department")?.toString(),
    notes: formData.get("notes")?.toString(),
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
    const data = await createManualWithFirstRevision(
      access,
      parsed.data,
      {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        bytes,
      },
      {
        revisionNumber: formData.get("revisionNumber")?.toString() ?? null,
        revisionDate: formData.get("revisionDate")?.toString() ?? null,
      },
    );
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ManualConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
