import { rejectCrossOrigin } from "@/lib/auth/request-guard";
import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  deleteParticulars,
  getParticularsById,
  ParticularsConflictError,
  ParticularsNotFoundError,
  updateParticulars,
} from "@/modules/ship-particulars/particulars.controller";
import { particularsUpdateSchema } from "@/modules/ship-particulars/validation";
import { mapGetError, isUuidParam, invalidUuidResponse } from "@/lib/api/route-errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!isUuidParam(id)) {
    return invalidUuidResponse("Particulars not found");
  }
  try {
    const row = await getParticularsById(toAccessContext(session), id);
    if (!row) {
      return NextResponse.json(
        { error: "Particulars not found" },
        { status: 404 },
      );
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
    return invalidUuidResponse("Particulars not found");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = particularsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await updateParticulars(access, id, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ParticularsNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ParticularsConflictError) {
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
    return invalidUuidResponse("Particulars not found");
  }
  try {
    await deleteParticulars(toAccessContext(session), id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ParticularsNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ParticularsConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
