import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import type { CrewStatus } from "@/db/schema";
import {
  createCrewMember,
  CrewConflictError,
  listCrewMembers,
} from "@/modules/crew/crew.controller";
import { CREW_STATUSES } from "@/modules/crew/crew.model";
import { crewMemberCreateSchema } from "@/modules/crew/validation";

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const vesselId = url.searchParams.get("vesselId") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam &&
    (CREW_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as CrewStatus)
      : undefined;

  const data = await listCrewMembers(toAccessContext(session), {
    vesselId,
    status,
    categoryId,
  });
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

  const parsed = crewMemberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await createCrewMember(access, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof CrewConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
