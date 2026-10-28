/**
 * Certificate domain types and presentation helpers.
 *
 * No database access (that's `certificate.controller.ts`) and no
 * `server-only` — safe to import from client components. Re-exports enums
 * and the effective-offset precedence rule used when calling the expiry engine.
 *
 * Spec: PROJECT_PLAN.md §1.
 */
import {
  certificateAuthorityEnum,
  certificateEventTypeEnum,
  certificateLifecycleEnum,
  reminderRuleKindEnum,
  type CertificateRow,
  type CertificateTypeRow,
} from "@/db/schema";
import {
  compareBySeverity,
  isActionable,
  STATUS_LABELS,
  STATUS_STYLES,
  type ComplianceResult,
  type ComplianceStatus,
} from "@/lib/expiry";

export type {
  CertificateAttachmentRow,
  CertificateEventRow,
  CertificateRow,
  CertificateTypeRow,
  IssuingAuthorityRow,
} from "@/db/schema";
export type {
  CertificateAuthority,
  CertificateLifecycle,
  ReminderRuleKind,
} from "@/db/schema";

/** List-row shape with joins + live compliance (safe for client props). */
export type CertificateListItem = CertificateRow & {
  vesselName: string;
  typeName: string;
  authority: CertificateTypeRow["authority"];
  ruleKind: CertificateTypeRow["ruleKind"];
  typeOffsetDays: number | null;
  issuingAuthorityName: string | null;
  compliance: ComplianceResult;
  /** Joined type name of the parent certificate, if this row is a sub-item. */
  parentCertificateName: string | null;
  /** Count of linked sub-items; 0 for certificates that are not parents. */
  subItemCount: number;
};

/** Authority options for `<select>` / filters. */
export const CERTIFICATE_AUTHORITIES = certificateAuthorityEnum;
/** Lifecycle options for forms. */
export const CERTIFICATE_LIFECYCLES = certificateLifecycleEnum;
/** Reminder rule kinds (type catalog). */
export const REMINDER_RULE_KINDS = reminderRuleKindEnum;
/** Event types for the history log form. */
export const CERTIFICATE_EVENT_TYPES = certificateEventTypeEnum;

/**
 * Effective `offsetDays` passed to the expiry engine (PROJECT_PLAN.md §1):
 * `customOffsetDays` if set → else `180` if `linkedToDryDock` → else the
 * certificate type's `offsetDays`. Easy to quietly break — keep this as the
 * single implementation every write/read path uses.
 */
export function effectiveOffsetDays(
  cert: { customOffsetDays: number | null; linkedToDryDock: boolean },
  typeOffsetDays: number | null,
): number | null {
  if (cert.customOffsetDays != null) {
    return cert.customOffsetDays;
  }
  if (cert.linkedToDryDock) {
    return 180;
  }
  return typeOffsetDays;
}

/**
 * Worst compliance among a parent's sub-items, or null when there are none.
 * Uses the expiry engine's severity ordering — do not re-implement it.
 */
export function worstSubItemCompliance(
  children: Pick<CertificateListItem, "compliance">[],
): ComplianceResult | null {
  if (children.length === 0) {
    return null;
  }
  const sorted = children
    .map((child) => child.compliance)
    .sort(compareBySeverity);
  return sorted[0] ?? null;
}

/**
 * The sub-item compliance worth surfacing on a parent row: the worst child,
 * only when it is actionable (expiring / critical / expired) and its STATUS is
 * strictly worse than the parent's own. Days remaining are deliberately
 * ignored (nulled) so a same-status child with fewer days left does not
 * trigger a redundant pill next to an equal parent status.
 */
export function worseActionableSubItemCompliance(
  parent: ComplianceResult,
  children: Pick<CertificateListItem, "compliance">[],
): ComplianceResult | null {
  const worst = worstSubItemCompliance(children);
  if (!worst || !isActionable(worst.status)) {
    return null;
  }
  const worseByStatus =
    compareBySeverity(
      { ...worst, daysRemaining: null },
      { ...parent, daysRemaining: null },
    ) < 0;
  return worseByStatus ? worst : null;
}

/** Client-facing label for a live engine status (3-color + gray neutrals). */
export function complianceLabel(status: ComplianceStatus): string {
  return STATUS_LABELS[status];
}

/** Tailwind badge classes from the shared engine. */
export function complianceStyle(status: ComplianceStatus): string {
  return STATUS_STYLES[status];
}

/** Title-case an authority enum value for display. */
export function formatAuthority(authority: string): string {
  return authority.charAt(0).toUpperCase() + authority.slice(1);
}
