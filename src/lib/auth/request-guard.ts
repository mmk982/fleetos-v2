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
import { NextResponse } from "next/server";

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
 * Route Handler variant of {@link assertSameOriginMutation}: returns a ready
 * `403` JSON response for a cross-origin mutating request, or `null` when the
 * request may proceed. Call first in every `POST` / `PUT` / `PATCH` /
 * `DELETE` handler under `/api` (cron endpoints authenticate by bearer secret
 * instead and must not use this).
 */
export async function rejectCrossOrigin(): Promise<NextResponse | null> {
  try {
    await assertSameOriginMutation();
    return null;
  } catch (error) {
    if (error instanceof CrossOriginRequestError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

/**
 * Parses `TRUSTED_PROXY_HOPS` (default `0`). Invalid / negative / non-integer
 * values fall back to `0` (trust nothing) rather than guessing.
 */
export function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    return 0;
  }
  return Number.parseInt(raw, 10);
}

let trustedProxyHopsWarned = false;

/**
 * Logs once in production when `TRUSTED_PROXY_HOPS` is effectively `0`
 * (missing, invalid, or explicit). Does not throw — login still works, but
 * IP rate-limit buckets may collapse to `"unknown"` / forgeable `X-Real-IP`.
 * Exported for unit tests; also invoked from {@link getRequestIp}.
 */
export function warnTrustedProxyHopsIfNeeded(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (trustedProxyHopsWarned) return;
  if (env.NODE_ENV !== "production") return;
  const raw = env.TRUSTED_PROXY_HOPS?.trim();
  const hops =
    raw && /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : 0;
  if (hops !== 0) return;
  trustedProxyHopsWarned = true;
  console.warn(
    JSON.stringify({
      level: "warn",
      code: "TRUSTED_PROXY_HOPS_ZERO",
      message:
        "TRUSTED_PROXY_HOPS is 0 in production — X-Forwarded-For is ignored; set to 1 behind Caddy (see docs/DEPLOY.md).",
      ts: new Date().toISOString(),
    }),
  );
}

/** Test-only: reset the one-shot production warning latch. */
export function resetTrustedProxyHopsWarningForTests(): void {
  trustedProxyHopsWarned = false;
}

/**
 * Best-effort client IP for rate limiting. Not used for security decisions
 * beyond coarse login throttling.
 *
 * `X-Forwarded-For` is client-controlled on its left side: every proxy
 * *appends* the address it saw, so only entries added by proxies we operate
 * are trustworthy, and those are at the **right** end. The leftmost value is
 * whatever the client chose to send and must never become a rate-limit key.
 *
 * Controlled by `TRUSTED_PROXY_HOPS` (the number of reverse proxies we run in
 * front of the app):
 * - `0` (default): `X-Forwarded-For` is ignored entirely; uses `X-Real-IP`
 *   if present, else `"unknown"`.
 * - `N ≥ 1`: takes the entry N positions from the **right** of
 *   `X-Forwarded-For` (1 = rightmost = the address the nearest trusted proxy
 *   saw; e.g. a single Caddy hop → `1`). If the header has fewer than N
 *   entries or that entry is empty, falls back to `X-Real-IP`, then
 *   `"unknown"`.
 */
export async function getRequestIp(): Promise<string> {
  warnTrustedProxyHopsIfNeeded();
  const h = await headers();
  const hops = trustedProxyHops();

  if (hops >= 1) {
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((part) => part.trim());
      const candidate = parts[parts.length - hops];
      if (candidate) {
        return candidate;
      }
    }
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}
