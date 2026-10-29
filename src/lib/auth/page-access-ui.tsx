/**
 * Shared catch → notice mapping for vessel-scoped dashboard pages.
 */
import { AccessDeniedNotice } from "@/components/access-denied-notice";
import { NoVesselAssignedNotice } from "@/components/no-vessel-assigned-notice";
import type { AccessContext } from "@/lib/auth/access";
import { classifyPageAccessError } from "@/lib/auth/page-access";
import type { ReactElement } from "react";

/**
 * Returns a notice element for known access denials, or `null` so the
 * caller can rethrow.
 */
export function noticeForPageAccessError(
  error: unknown,
  ctx: AccessContext,
): ReactElement | null {
  const kind = classifyPageAccessError(error, ctx);
  if (kind === "missing-vessel") return <NoVesselAssignedNotice />;
  if (kind === "forbidden") return <AccessDeniedNotice />;
  return null;
}
