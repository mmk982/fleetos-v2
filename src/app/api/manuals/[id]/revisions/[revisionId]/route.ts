import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  ManualRevisionNotFoundError,
  setCurrentRevision,
} from "@/modules/manuals/manual.controller";

type RouteContext = {
  params: Promise<{ id: string; revisionId: string }>;
};

/** PATCH `{ isCurrentVersion: true }` to re-mark an older revision current. */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = toAccessContext(session);
  const { id: manualId, revisionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    (body as { isCurrentVersion?: unknown }).isCurrentVersion !== true
  ) {
    return NextResponse.json(
      { error: "Body must be { isCurrentVersion: true }" },
      { status: 400 },
    );
  }

  try {
    const data = await setCurrentRevision(access, manualId, revisionId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ManualRevisionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
