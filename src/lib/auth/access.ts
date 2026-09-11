/**
 * Controller-layer access context — the third defense layer
 * (`MASTER_IMPLEMENTATION_PLAN.md` Phase 3 / `auth-request-flow.mermaid`).
 *
 * Proxy (UX redirect) and Server Actions (`requireSession`) are layers one
 * and two. Controllers must receive an {@link AccessContext} and call
 * {@link assertAuthenticatedAccess} (and, later, role/vessel-scope helpers)
 * so a missed Action-level check is not the only thing between a request
 * and the database. Phase 6 RBAC and Phase 4/6 RLS attach here.
 */
import "server-only";

import type { SessionContext } from "@/lib/auth/session";

/** Caller identity passed into every controller mutating/read path. */
export type AccessContext = {
  /** Authenticated user's `users.id`. */
  userId: string;
  /**
   * Placeholder role string until Phase 6 RBAC — may be `null`. Controllers
   * must not invent permission grants from this field yet.
   */
  role: string | null;
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
  };
}

/**
 * Interim ownership/role gate. Until Phase 6, any authenticated user may
 * access any vessel (single-tier model) — this still *requires* a real
 * `userId` so controllers cannot be called with an empty/forged context
 * if an Action forgets `requireSession`.
 *
 * @param ctx - Caller identity from the Server Action / Route Handler.
 * @param _resourceId - Optional row id for future vessel-scoped RBAC.
 * @throws {ForbiddenError} when `ctx.userId` is missing.
 */
export function assertAuthenticatedAccess(
  ctx: AccessContext,
  resourceId?: string,
): void {
  if (!ctx.userId || ctx.userId.trim().length === 0) {
    throw new ForbiddenError("Authenticated access context required.");
  }
  // Phase 6: enforce role grants + vessel membership using `resourceId`.
  void resourceId;
}
