/**
 * Helpers for sanitising URL search params before they reach a query.
 *
 * Why: list pages pass `?vesselId=…` style filters straight into
 * `eq(<uuid column>, value)`. A non-UUID value (typo, tampered URL) makes
 * Postgres throw `invalid input syntax for type uuid` and the page 500s.
 * Boundary: shape check only — it grants no access; controllers still apply
 * RBAC / vessel scope to whatever id survives.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns `raw` only when it is a well-formed UUID, otherwise `undefined`
 * (i.e. "no filter"), so a bad URL param degrades to an unfiltered list.
 *
 * @param raw - A search-param value (may be missing, empty, or garbage).
 */
export function uuidSearchParam(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return UUID_PATTERN.test(raw) ? raw : undefined;
}
