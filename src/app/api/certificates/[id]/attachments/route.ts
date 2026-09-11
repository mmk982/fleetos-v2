import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  AttachmentValidationError,
  CertificateNotFoundError,
  getCertificateById,
  uploadCertificateAttachment,
} from "@/modules/certificates/certificate.controller";

type RouteContext = { params: Promise<{ id: string }> };

async function requireApiSession() {
  return validateSession();
}

/** GET attachment metadata for a certificate. */
export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const detail = await getCertificateById(toAccessContext(session), id);
  if (!detail) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }
  return NextResponse.json({ data: detail.attachments });
}

/**
 * POST multipart upload (`file` field). Max 10 MB; PDF/JPEG/PNG only.
 * Files land under `data/attachments/` with a generated name.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);
  const { id } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const data = await uploadCertificateAttachment(access, id, {
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
    if (error instanceof CertificateNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
