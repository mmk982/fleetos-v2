import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import {
  createDeficiency,
  DeficiencyConflictError,
  listDeficiencies,
} from "@/modules/deficiencies/deficiency.controller";
import { deficiencyCreateSchema } from "@/modules/deficiencies/validation";
import type { DeficiencyStatus } from "@/db/schema";

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
  const statusParam = url.searchParams.get("status");
  const sourceId = url.searchParams.get("sourceId") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const status = statusParam
    ? (statusParam as DeficiencyStatus)
    : undefined;

  const data = await listDeficiencies(toAccessContext(session), {
    vesselId,
    status,
    sourceId,
    category,
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

  const parsed = deficiencyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await createDeficiency(access, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DeficiencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
