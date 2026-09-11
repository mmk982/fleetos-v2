/**
 * Have I Been Pwned k-anonymity range check (`SECURITY_PLAN.md` §2.2).
 *
 * Intentionally **not** marked `server-only` — operational scripts
 * (`create-user.ts`, `reset-password.ts`) must call the same helper as the
 * app without hitting Next.js's client-bundle guard. Only the SHA-1
 * *prefix* (5 hex chars) leaves the process; the full password never does.
 */
import { createHash } from "node:crypto";

const PWNED_RANGE_URL = "https://api.pwnedpasswords.com/range/";

/**
 * Returns `true` when `plain` appears in the HIBP breach corpus.
 * On network/API failure, fails open (`false`) and lets the caller decide —
 * scripts should still enforce the 12-char minimum; an unreachable HIBP
 * must not brick admin password resets.
 *
 * @param plain - Candidate password; hashed locally, never sent in full.
 */
export async function isPasswordBreached(plain: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(plain, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  let body: string;
  try {
    const res = await fetch(`${PWNED_RANGE_URL}${prefix}`, {
      headers: {
        // HIBP asks callers to identify themselves; keep it generic.
        "Add-Padding": "true",
        "User-Agent": "FleetOS-password-check",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return false;
    }
    body = await res.text();
  } catch {
    return false;
  }

  for (const line of body.split("\n")) {
    const [hashSuffix] = line.trim().split(":");
    if (hashSuffix && hashSuffix.toUpperCase() === suffix) {
      return true;
    }
  }
  return false;
}

/**
 * Enforces SECURITY_PLAN.md §2.2 length + breach checks before a password
 * is accepted for storage. Throws an `Error` with a safe, user-facing
 * message (never includes the password).
 *
 * @param plain - Candidate new password.
 */
export async function assertPasswordAllowed(plain: string): Promise<void> {
  if (plain.length < 12) {
    throw new Error("Password must be at least 12 characters (SECURITY_PLAN.md §2.2).");
  }
  if (await isPasswordBreached(plain)) {
    throw new Error(
      "That password appears in a known data breach. Choose a different password.",
    );
  }
}
