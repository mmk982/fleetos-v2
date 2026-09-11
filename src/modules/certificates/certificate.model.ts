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
} from "@/db/schema";
import {
  STATUS_LABELS,
  STATUS_STYLES,
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
