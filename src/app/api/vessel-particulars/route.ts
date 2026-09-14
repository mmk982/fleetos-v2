import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  createParticulars,
  listParticulars,
  listVesselParticularsSummary,
  ParticularsConflictError,
} from "@/modules/ship-particulars/particulars.controller";
import { particularsCreateSchema } from "@/modules/ship-particulars/validation";

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);
  const url = new URL(request.url);
  const vesselId = url.searchParams.get("vesselId") ?? undefined;
  const isCurrentParam = url.searchParams.get("isCurrent");

  if (!vesselId && isCurrentParam === null) {
    const data = await listVesselParticularsSummary(access);
    return NextResponse.json({ data });
  }

  const isCurrent =
    isCurrentParam === null
      ? undefined
      : isCurrentParam === "true" || isCurrentParam === "1";

  const data = await listParticulars(access, { vesselId, isCurrent });
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

  const parsed = particularsCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await createParticulars(access, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ParticularsConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
