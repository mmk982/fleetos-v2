import { rejectCrossOrigin } from "@/lib/auth/request-guard";
import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  deleteDrawing,
  DrawingConflictError,
  DrawingNotFoundError,
  getDrawingById,
  updateDrawing,
} from "@/modules/drawings/drawing.controller";
import { drawingUpdateSchema } from "@/modules/drawings/validation";
import { mapGetError, isUuidParam, invalidUuidResponse } from "@/lib/api/route-errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!isUuidParam(id)) {
    return invalidUuidResponse("Drawing not found");
  }
  try {
    const row = await getDrawingById(toAccessContext(session), id);
    if (!row) {
      return NextResponse.json({ error: "Drawing not found" }, { status: 404 });
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

  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);
  const { id } = await context.params;
  if (!isUuidParam(id)) {
    return invalidUuidResponse("Drawing not found");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = drawingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await updateDrawing(access, id, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DrawingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DrawingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const crossOrigin = await rejectCrossOrigin();
  if (crossOrigin) return crossOrigin;

  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!isUuidParam(id)) {
    return invalidUuidResponse("Drawing not found");
  }
  try {
    await deleteDrawing(toAccessContext(session), id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DrawingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DrawingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
