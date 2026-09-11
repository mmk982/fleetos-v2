/**
 * Password hashing seam — Argon2id only (`SECURITY_PLAN.md` §2.1 /
 * `MASTER_IMPLEMENTATION_PLAN.md` Phase 3).
 *
 * Shared/foundational (`CODE_CONVENTIONS.md` §5): every future auth path
 * (login, Admin-set password, break-glass reset script) must call into
 * these helpers rather than invoking `argon2` directly, so the OWASP
 * parameter profile stays consistent.
 *
 * Parameters (`m=19456` KiB ≈ 19 MiB, `t=2`, `p=1`) are the lighter OWASP
 * baseline chosen for this app's modest shared-VPS sizing. The library
 * encodes them into the PHC hash string, so raising costs later does not
 * invalidate existing hashes — `verifyPassword` reads the embedded params.
 */
import "server-only";

import { argon2id, hash, verify, type HashOptions } from "argon2";

/**
 * OWASP lighter Argon2id profile for FleetOS (`SECURITY_PLAN.md` §2.1).
 * `memoryCost` is in KiB for `node-argon2` (19456 KiB = 19 MiB).
 */
const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hashes a plaintext password with Argon2id using FleetOS's locked
 * parameter profile. Returns a PHC-formatted string that embeds the
 * algorithm, costs, salt, and digest.
 *
 * @param plain - Raw password; never log or persist this value.
 * @returns PHC hash string suitable for `users.password_hash`.
 */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against a stored PHC Argon2 hash.
 * Uses the parameters embedded in `hash`, so hashes produced under an
 * older cost profile still verify correctly after a future upgrade.
 *
 * @param hashDigest - Stored PHC string from {@link hashPassword}.
 * @param plain - Candidate plaintext password.
 * @returns `true` only on an exact match; `false` for mismatch or
 *   malformed digest (does not throw on ordinary verify failures).
 */
export async function verifyPassword(hashDigest: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashDigest, plain);
  } catch {
    // Malformed/truncated digests surface as thrown errors from the binding;
    // treat them as non-matches so callers can return a generic auth failure.
    return false;
  }
}
