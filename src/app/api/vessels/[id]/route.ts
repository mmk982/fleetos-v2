import { NextResponse } from "next/server";
import {
  deleteVessel,
  getVesselById,
  updateVessel,
  VesselConflictError,
  VesselNotFoundError,
} from "@/modules/vessels/vessel.controller";
import { vesselUpdateSchema } from "@/modules/vessels/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const row = getVesselById(id);
  if (!row) {
    return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
  }
  return NextResponse.json({ data: row });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

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
    const data = updateVessel(id, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof VesselNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof VesselConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    deleteVessel(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof VesselNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
