/**
 * Mutating-request origin guard (`SECURITY_PLAN.md` §3).
 *
 * Defense-in-depth alongside Next.js Server Action same-origin protections:
 * reject requests whose `Sec-Fetch-Site` is `cross-site`, or whose `Origin`
 * host does not match this request's `Host`. Call at the top of every
 * mutating Server Action (login, vessel create/update/delete, …).
 */
import "server-only";

import { headers } from "next/headers";

/** Thrown when a mutating action looks cross-origin. */
export class CrossOriginRequestError extends Error {
  readonly code = "CROSS_ORIGIN_REQUEST" as const;
  constructor() {
    super("Cross-origin mutating request blocked.");
    this.name = "CrossOriginRequestError";
  }
}

/**
 * Verifies `Sec-Fetch-Site` / `Origin` for the current request.
 *
 * @throws {CrossOriginRequestError} when the request appears cross-site.
 */
export async function assertSameOriginMutation(): Promise<void> {
  const h = await headers();
  const site = h.get("sec-fetch-site");

  if (site === "cross-site") {
    throw new CrossOriginRequestError();
  }

  // Modern browsers send same-origin / same-site / none for first-party forms.
  if (site === "same-origin" || site === "same-site" || site === "none") {
    return;
  }

  // Fallback when Sec-Fetch-Site is absent (non-browser clients, older agents).
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host) {
    // Same-origin Server Actions from the app always send Origin; missing
    // both is treated as suspicious for mutating POSTs.
    throw new CrossOriginRequestError();
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new CrossOriginRequestError();
  }

  if (originHost.toLowerCase() !== host.toLowerCase()) {
    throw new CrossOriginRequestError();
  }
}

/**
 * Best-effort client IP for rate limiting (first `X-Forwarded-For` hop, or
 * `X-Real-IP`, else `"unknown"`). Not used for security decisions beyond
 * coarse login throttling.
 */
export async function getRequestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}
