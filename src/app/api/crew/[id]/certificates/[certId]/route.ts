import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  CrewCertificateConflictError,
  CrewCertificateNotFoundError,
  deleteCrewCertificate,
  getCrewCertificateById,
  listCrewCertificateAttachments,
  updateCrewCertificate,
} from "@/modules/crew/crew-certificate.controller";
import { crewCertificateUpdateSchema } from "@/modules/crew/validation";

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
  const cert = await getCrewCertificateById(access, certId, { logView: true });
  if (!cert || cert.crewMemberId !== crewMemberId) {
    return NextResponse.json(
      { error: "Crew certificate not found" },
      { status: 404 },
    );
  }
  const attachments = await listCrewCertificateAttachments(access, certId);
  return NextResponse.json({ data: { ...cert, attachments } });
}

export async function PATCH(request: Request, context: RouteContext) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = crewCertificateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await updateCrewCertificate(access, certId, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof CrewCertificateNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof CrewCertificateConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  try {
    await deleteCrewCertificate(access, certId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof CrewCertificateNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
