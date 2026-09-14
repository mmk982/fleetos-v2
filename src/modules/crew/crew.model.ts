/**
 * Crew domain types and presentation helpers.
 *
 * No database access (that's the controllers) and no `server-only` — safe
 * for client components. Crew member status uses StatusPill `tone`; crew
 * certificate expiry uses engine `status` (ComplianceStatus).
 *
 * Spec: PROJECT_PLAN.md §3.
 */
import {
  crewStatusEnum,
  type CrewCertificateRow,
  type CrewMemberRow,
} from "@/db/schema";
import type { StatusPillTone } from "@/components/ui/status-pill";
import type { ComplianceResult } from "@/lib/expiry";

export type {
  CrewCategoryRow,
  CrewCertificateAttachmentRow,
  CrewCertificateRow,
  CrewMemberRow,
  EndorsementTypeRow,
} from "@/db/schema";
export type { CrewStatus } from "@/db/schema";

/** Fixed reminder rule for every crew certificate (§3). */
export const CREW_CERTIFICATE_REMINDER_RULE = {
  kind: "expiry_offset" as const,
  offsetDays: 30,
};

/** List-row shape with vessel/category joins (safe for client props). */
export type CrewMemberListItem = CrewMemberRow & {
  vesselName: string | null;
  categoryName: string | null;
};

/** Crew certificate with live compliance + optional endorsement label. */
export type CrewCertificateListItem = CrewCertificateRow & {
  endorsementTypeName: string | null;
  compliance: ComplianceResult;
};

export const CREW_STATUSES = crewStatusEnum;

/**
 * StatusPill tone for crew member active/inactive.
 * active → success (fit for duty), inactive → warning (off roster).
 */
export function crewMemberStatusTone(
  status: (typeof crewStatusEnum)[number],
): StatusPillTone {
  if (status === "active") return "success";
  return "warning";
}

export function crewMemberStatusLabel(
  status: (typeof crewStatusEnum)[number],
): string {
  if (status === "active") return "Active";
  return "Inactive";
}

export function crewMemberDisplayName(row: {
  firstName: string;
  lastName: string;
}): string {
  return `${row.firstName} ${row.lastName}`.trim();
}
