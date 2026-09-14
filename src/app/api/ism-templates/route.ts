import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import type { IsmTemplateStatus } from "@/db/schema";
import {
  createIsmTemplate,
  IsmTemplateConflictError,
  listIsmTemplates,
} from "@/modules/ism-templates/ismTemplate.controller";
import { ISM_TEMPLATE_STATUSES } from "@/modules/ism-templates/ismTemplate.model";
import { ismTemplateCreateSchema } from "@/modules/ism-templates/validation";

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam &&
    (ISM_TEMPLATE_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as IsmTemplateStatus)
      : undefined;

  const data = await listIsmTemplates(toAccessContext(session), {
    categoryId,
    status,
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

  const parsed = ismTemplateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await createIsmTemplate(access, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof IsmTemplateConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
