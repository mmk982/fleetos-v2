import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import type { ComplianceStatus } from "@/lib/expiry";
import {
  CertificateConflictError,
  createCertificate,
  listCertificates,
} from "@/modules/certificates/certificate.controller";
import { certificateCreateSchema } from "@/modules/certificates/validation";

async function requireApiSession() {
  return validateSession();
}

export async function GET(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const vesselId = url.searchParams.get("vesselId") ?? undefined;
  const authority = url.searchParams.get("authority") ?? undefined;
  const issuingAuthorityId =
    url.searchParams.get("issuingAuthorityId") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status = statusParam
    ? (statusParam as ComplianceStatus)
    : undefined;

  const data = await listCertificates(toAccessContext(session), {
    vesselId,
    authority,
    issuingAuthorityId,
    status,
  });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = certificateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await createCertificate(access, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof CertificateConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
