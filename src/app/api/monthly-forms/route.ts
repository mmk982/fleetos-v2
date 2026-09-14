import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import type { MonthlyFormStatus } from "@/db/schema";
import {
  createMonthlyForm,
  listMonthlyForms,
  MonthlyFormConflictError,
} from "@/modules/monthly-forms/monthlyForm.controller";
import { MONTHLY_FORM_STATUSES } from "@/modules/monthly-forms/monthlyForm.model";
import { monthlyFormCreateSchema } from "@/modules/monthly-forms/validation";

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const vesselId = url.searchParams.get("vesselId") ?? undefined;
  const monthParam = url.searchParams.get("month");
  const yearParam = url.searchParams.get("year");
  const statusParam = url.searchParams.get("status");
  const month = monthParam ? Number(monthParam) : undefined;
  const year = yearParam ? Number(yearParam) : undefined;
  const status =
    statusParam &&
    (MONTHLY_FORM_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as MonthlyFormStatus)
      : undefined;

  const data = await listMonthlyForms(toAccessContext(session), {
    vesselId,
    month: Number.isFinite(month) ? month : undefined,
    year: Number.isFinite(year) ? year : undefined,
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

  const parsed = monthlyFormCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await createMonthlyForm(access, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof MonthlyFormConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
