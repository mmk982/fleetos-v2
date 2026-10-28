/**
 * Shared Authorization check for server-to-server cron endpoints.
 *
 * Fail closed: missing or short secrets never authenticate, including the
 * classic `Bearer undefined` trap when `CRON_SECRET` is unset.
 */
import { timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 32;

/**
 * Returns true only when `header` is exactly `Bearer <secret>` and `secret`
 * is a configured value of at least 32 characters.
 */
export function isValidCronAuth(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (secret == null || secret.length < MIN_SECRET_LENGTH) {
    return false;
  }
  if (header == null) {
    return false;
  }

  const expected = `Bearer ${secret}`;
  const provided = Buffer.from(header);
  const required = Buffer.from(expected);
  if (provided.length !== required.length) {
    return false;
  }
  return timingSafeEqual(provided, required);
}
