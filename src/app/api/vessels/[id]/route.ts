import { rejectCrossOrigin } from "@/lib/auth/request-guard";
import { NextResponse } from "next/server";
import { toAccessContext } from "@/lib/auth/access";
import {
  invalidUuidResponse,
  isUuidParam,
  mapGetError,
} from "@/lib/api/route-errors";
import { validateSession } from "@/lib/auth/session";
import {
  deleteVessel,
  getVesselById,
  updateVessel,
  VesselConflictError,
} from "@/modules/vessels/vessel.controller";
import { vesselUpdateSchema } from "@/modules/vessels/validation";

type RouteContext = { params: Promise<{ id: string }> };

async function requireApiSession() {
  const session = await validateSession();
  if (!session) {
    return null;
  }
  return session;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!isUuidParam(id)) {
    return invalidUuidResponse("Vessel not found");
  }
  try {
    const row = await getVesselById(toAccessContext(session), id);
    if (!row) {
      return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    }
    return NextResponse.json({ data: row });
  } catch (error) {
    const mapped = mapGetError(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const crossOrigin = await rejectCrossOrigin();
  if (crossOrigin) return crossOrigin;

  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);
  const { id } = await context.params;
  if (!isUuidParam(id)) {
    return invalidUuidResponse("Vessel not found");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = vesselUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await updateVessel(access, id, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    const mapped = mapGetError(error);
    if (mapped) return mapped;
    if (error instanceof VesselConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const crossOrigin = await rejectCrossOrigin();
  if (crossOrigin) return crossOrigin;

  const session = await requireApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!isUuidParam(id)) {
    return invalidUuidResponse("Vessel not found");
  }
  try {
    await deleteVessel(toAccessContext(session), id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const mapped = mapGetError(error);
    if (mapped) return mapped;
    if (error instanceof VesselConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
