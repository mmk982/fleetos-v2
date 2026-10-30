/**
 * Detect Postgres SQLSTATE codes on errors thrown through drizzle-orm.
 *
 * Drizzle 0.45+ wraps driver errors in `DrizzleQueryError` and exposes the
 * original on `.cause`. Helpers that only inspect the outer `error.code`
 * never match, so controllers miss their conflict branches and leak 500s.
 */

const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Walks `error` → `.cause` (max depth 5, cycle-safe) and returns the first
 * string `code` that looks like a SQLSTATE (5 alphanumerics).
 */
export function getPgErrorCode(error: unknown): string | undefined {
  const seen = new Set<object>();
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth++) {
    if (!isRecord(current)) return undefined;
    if (seen.has(current)) return undefined;
    seen.add(current);

    const code = current.code;
    if (typeof code === "string" && SQLSTATE_PATTERN.test(code)) {
      return code;
    }
    current = current.cause;
  }
  return undefined;
}

/**
 * Same walk as {@link getPgErrorCode}, returning the first string
 * `constraint` property (Postgres constraint name). Prefer for logging —
 * do not expose to clients.
 */
export function getPgConstraintName(error: unknown): string | undefined {
  const seen = new Set<object>();
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth++) {
    if (!isRecord(current)) return undefined;
    if (seen.has(current)) return undefined;
    seen.add(current);

    const constraint = current.constraint;
    if (typeof constraint === "string" && constraint.length > 0) {
      return constraint;
    }
    current = current.cause;
  }
  return undefined;
}

/** SQLSTATE `23505` — unique_violation. */
export function isPgUniqueViolation(error: unknown): boolean {
  return getPgErrorCode(error) === "23505";
}

/** SQLSTATE `23503` — foreign_key_violation. */
export function isPgForeignKeyViolation(error: unknown): boolean {
  return getPgErrorCode(error) === "23503";
}

/** SQLSTATE `22P02` — invalid_text_representation (e.g. malformed uuid). */
export function isPgInvalidTextRepresentation(error: unknown): boolean {
  return getPgErrorCode(error) === "22P02";
}
