import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  createVesselNote,
  listVesselNotes,
  VesselNoteConflictError,
} from "@/modules/ship-particulars/vessel-notes.controller";
import { vesselNoteCreateSchema } from "@/modules/ship-particulars/validation";

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const vesselId = new URL(request.url).searchParams.get("vesselId");
  if (!vesselId) {
    return NextResponse.json(
      { error: "vesselId query parameter is required" },
      { status: 400 },
    );
  }
  const data = await listVesselNotes(toAccessContext(session), vesselId);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const session = await validateSession();
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

  const parsed = vesselNoteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await createVesselNote(
      access,
      parsed.data.vesselId,
      parsed.data.body,
    );
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof VesselNoteConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
