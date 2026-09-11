import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  addCertificateEvent,
  CertificateNotFoundError,
  getCertificateById,
} from "@/modules/certificates/certificate.controller";
import { certificateEventCreateSchema } from "@/modules/certificates/validation";

type RouteContext = { params: Promise<{ id: string }> };

async function requireApiSession() {
  return validateSession();
}

/** GET events for a certificate (nested under `/api/certificates/[id]/events`). */
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
  return NextResponse.json({ data: detail.events });
}

/** POST a new event on a certificate. */
export async function POST(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = certificateEventCreateSchema.safeParse({
    ...(typeof body === "object" && body !== null ? body : {}),
    certificateId: id,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await addCertificateEvent(access, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof CertificateNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
