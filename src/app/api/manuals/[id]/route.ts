import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  deleteManual,
  getManualById,
  ManualConflictError,
  ManualNotFoundError,
  updateManual,
} from "@/modules/manuals/manual.controller";
import { manualUpdateSchema } from "@/modules/manuals/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const row = await getManualById(toAccessContext(session), id);
  if (!row) {
    return NextResponse.json({ error: "Manual not found" }, { status: 404 });
  }
  return NextResponse.json({ data: row });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await validateSession();
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

  const parsed = manualUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await updateManual(access, id, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ManualNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ManualConflictError) {
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
  const { id } = await context.params;
  try {
    await deleteManual(toAccessContext(session), id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ManualNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
