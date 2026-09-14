import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  AttachmentValidationError,
  CrewCertificateNotFoundError,
  getCrewCertificateById,
  listCrewCertificateAttachments,
  uploadCrewCertificateAttachment,
} from "@/modules/crew/crew-certificate.controller";

type RouteContext = {
  params: Promise<{ id: string; certId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);
  const { id: crewMemberId, certId } = await context.params;

  const cert = await getCrewCertificateById(access, certId);
  if (!cert || cert.crewMemberId !== crewMemberId) {
    return NextResponse.json(
      { error: "Crew certificate not found" },
      { status: 404 },
    );
  }

  const data = await listCrewCertificateAttachments(access, certId);
  return NextResponse.json({ data });
}

/** POST multipart upload (`file` field). Max 10 MB; PDF/JPEG/PNG. */
export async function POST(request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);
  const { id: crewMemberId, certId } = await context.params;

  const existing = await getCrewCertificateById(access, certId);
  if (!existing || existing.crewMemberId !== crewMemberId) {
    return NextResponse.json(
      { error: "Crew certificate not found" },
      { status: 404 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const data = await uploadCrewCertificateAttachment(access, certId, {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      bytes,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof CrewCertificateNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
