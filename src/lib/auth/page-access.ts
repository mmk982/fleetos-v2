/**
 * Page-layer access decisions — map controller ForbiddenError subclasses to
 * UI notices, and plan which monthly-forms / vessel-registry data to load.
 * Controllers stay fail-closed; pages catch and render.
 */
import "server-only";

import {
  ForbiddenError,
  MissingVesselAssignmentError,
  type AccessContext,
} from "@/lib/auth/access";
import {
  getModuleAccess,
  getMonthlyFormAccess,
} from "@/lib/auth/permissions";
import type { UserRole } from "@/db/schema";

/** How a dashboard page should handle a caught access error. */
export type PageAccessDenial = "missing-vessel" | "forbidden";

/**
 * Classifies access errors for page catch blocks.
 * - {@link MissingVesselAssignmentError} → no-vessel notice
 * - other {@link ForbiddenError} → generic access-denied notice
 * - anything else → null (rethrow)
 */
export function classifyPageAccessError(
  error: unknown,
  _ctx?: AccessContext,
): PageAccessDenial | null {
  void _ctx;
  if (error instanceof MissingVesselAssignmentError) return "missing-vessel";
  if (error instanceof ForbiddenError) return "forbidden";
  return null;
}

/** What the monthly-forms list page may load / show for a role. */
export type MonthlyFormsPageDataPlan = {
  loadRequirements: boolean;
  canManageRequirements: boolean;
  canCreateAdHoc: boolean;
  canGenerateChecklist: boolean;
};

/**
 * Requirements CRUD + checklist generate need `full` monthly access.
 * Submit roles still list/open/submit executed forms — do not call
 * `listMonthlyFormRequirements` for them.
 */
export function planMonthlyFormsPageData(
  role: UserRole | null,
): MonthlyFormsPageDataPlan {
  const access = getMonthlyFormAccess(role);
  const full = access === "full";
  return {
    loadRequirements: full,
    canManageRequirements: full,
    canCreateAdHoc: full,
    canGenerateChecklist: full,
  };
}

/** Vessel registry pages (`/dashboard/vessels*`) — only `vessels` read. */
export function planVesselRegistryPageAccess(
  role: UserRole | null,
): "allow" | "deny" {
  return getModuleAccess(role, "vessels") === "none" ? "deny" : "allow";
}
