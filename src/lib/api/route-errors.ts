/**
 * Tiny shared mappers for Route Handler error → HTTP status.
 * Intentionally small — not a framework. Mutations already inline the same
 * Forbidden / NotFound / Conflict branches; GETs reuse these helpers.
 */
import { NextResponse } from "next/server";
import { ForbiddenError } from "@/lib/auth/access";
import { isPgInvalidTextRepresentation } from "@/lib/db/pg-errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `value` is a well-formed UUID (any version). */
export function isUuidParam(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * 404 response for a malformed route-param UUID (A-20). Prefer this over
 * letting Postgres raise `22P02` as a 500.
 */
export function invalidUuidResponse(
  message = "Not found",
): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Maps controller/DB read failures that should not surface as 500:
 * ForbiddenError → 403, *NotFoundError → 404, SQLSTATE 22P02 → 404.
 *
 * @returns A response, or `null` when the caller should rethrow.
 */
export function mapGetError(error: unknown): NextResponse | null {
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof Error && /NotFoundError$/.test(error.name)) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (isPgInvalidTextRepresentation(error)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
