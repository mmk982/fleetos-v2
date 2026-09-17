/**
 * Controller-layer access context — the third defense layer
 * (`MASTER_IMPLEMENTATION_PLAN.md` Phase 3 / `auth-request-flow.mermaid`).
 *
 * Proxy (UX redirect) and Server Actions (`requireSession`) are layers one
 * and two. Controllers must receive an {@link AccessContext} and call
 * {@link assertAuthenticatedAccess}, then {@link assertModuleAccess} /
 * {@link assertVesselScope} as needed, so a missed Action-level check is
 * not the only thing between a request and the database. Phase 6 RBAC
 * attaches here; Phase 4 RLS (per-transaction `SET LOCAL`) remains a
 * separate prerequisite.
 */
import "server-only";

import type { UserRole } from "@/db/schema";
import type { SessionContext } from "@/lib/auth/session";
import {
  accessMeetsRequirement,
  getModuleAccess,
  type ModuleKey,
} from "@/lib/auth/permissions";

/** Caller identity passed into every controller mutating/read path. */
export type AccessContext = {
  /** Authenticated user's `users.id`. */
  userId: string;
  /**
   * Phase 6 role — may be `null` only for legacy/malformed sessions.
   * Prefer {@link getModuleAccess} / {@link assertModuleAccess} over
   * ad-hoc role string compares.
   */
  role: string | null;
  /**
   * Vessel FK for `management_user` / `vessel_user`; null for office roles
   * (`admin` / `superintendent` / `read_only`).
   */
  vesselId: string | null;
};

/** Thrown when a controller is invoked without a usable access context. */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Builds an {@link AccessContext} from a validated session.
 *
 * @param session - Result of `requireSession()` / `validateSession()`.
 */
export function toAccessContext(session: SessionContext): AccessContext {
  return {
    userId: session.user.id,
    role: session.user.role ?? null,
    vesselId: session.user.vesselId ?? null,
  };
}

/**
 * Requires a real `userId` so controllers cannot be called with an
 * empty/forged context if an Action forgets `requireSession`.
 *
 * @param ctx - Caller identity from the Server Action / Route Handler.
 * @param _resourceId - Optional row id (reserved; vessel scope uses
 *   {@link assertVesselScope} with an explicit vessel id).
 * @throws {ForbiddenError} when `ctx.userId` is missing.
 */
export function assertAuthenticatedAccess(
  ctx: AccessContext,
  resourceId?: string,
): void {
  if (!ctx.userId || ctx.userId.trim().length === 0) {
    throw new ForbiddenError("Authenticated access context required.");
  }
  void resourceId;
}

/**
 * Enforces coarse module access from {@link getModuleAccess}.
 * Call after {@link assertAuthenticatedAccess}, never instead of it.
 *
 * @throws {ForbiddenError} when granted access does not meet `required`
 *   (`write` implies `read`).
 */
export function assertModuleAccess(
  ctx: AccessContext,
  moduleKey: ModuleKey,
  required: "read" | "write",
): void {
  assertAuthenticatedAccess(ctx);
  const granted = getModuleAccess(ctx.role as UserRole | null, moduleKey);
  if (!accessMeetsRequirement(granted, required)) {
    throw new ForbiddenError(
      `Insufficient access for module "${moduleKey}" (need ${required}).`,
    );
  }
}

const OFFICE_ROLES: ReadonlySet<UserRole> = new Set([
  "admin",
  "superintendent",
  "read_only",
]);

/**
 * Vessel-scoping gate for vessel-based roles. No-op for office roles
 * (`admin` / `superintendent` / `read_only`).
 *
 * @throws {ForbiddenError} when a vessel-scoped caller’s `ctx.vesselId`
 *   does not match the resource `vesselId`.
 */
export function assertVesselScope(
  ctx: AccessContext,
  vesselId: string | null,
): void {
  assertAuthenticatedAccess(ctx);
  const role = ctx.role as UserRole | null;
  if (role === null || OFFICE_ROLES.has(role)) {
    return;
  }
  if (vesselId !== ctx.vesselId) {
    throw new ForbiddenError("Vessel scope mismatch.");
  }
}
