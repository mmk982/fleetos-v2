import { NextResponse } from "next/server";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { validateSession } from "@/lib/auth/session";
import type { InsuranceType } from "@/db/schema";
import {
  createInsurancePolicy,
  InsuranceConflictError,
  listInsurancePolicies,
} from "@/modules/insurance/insurance.controller";
import { INSURANCE_TYPES } from "@/modules/insurance/insurance.model";
import { insuranceCreateSchema } from "@/modules/insurance/validation";

export async function GET(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const vesselId = url.searchParams.get("vesselId") ?? undefined;
  const policyTypeParam = url.searchParams.get("policyType");
  const policyType =
    policyTypeParam &&
    (INSURANCE_TYPES as readonly string[]).includes(policyTypeParam)
      ? (policyTypeParam as InsuranceType)
      : undefined;

  const data = await listInsurancePolicies(toAccessContext(session), {
    vesselId,
    policyType,
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

  const parsed = insuranceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await createInsurancePolicy(access, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof InsuranceConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
