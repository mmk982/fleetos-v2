/**
 * Insurance domain types and presentation helpers.
 *
 * No database access and no `server-only` — safe for client components
 * (forms / StatusPill labels). Expiry uses the engine via controllers.
 *
 * Spec: PROJECT_PLAN.md §4.
 */
import {
  insuranceTypeEnum,
  type InsurancePolicyRow,
  type InsuranceType,
} from "@/db/schema";
import type { ComplianceResult } from "@/lib/expiry";

export type {
  InsuranceAttachmentRow,
  InsurancePolicyRow,
  InsuranceType,
} from "@/db/schema";

/** Fixed reminder rule for every insurance policy (§4 / CERTIFICATES_SPEC). */
export const INSURANCE_REMINDER_RULE = {
  kind: "expiry_offset" as const,
  offsetDays: 30,
};

/** List-row shape with vessel join + live compliance. */
export type InsuranceListItem = InsurancePolicyRow & {
  vesselName: string;
  compliance: ComplianceResult;
};

export const INSURANCE_TYPES = insuranceTypeEnum;

const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  pi: "P&I",
  hm: "H&M",
  war_risk: "War Risk",
  fdd: "FD&D",
  other: "Other",
};

export function insuranceTypeLabel(type: InsuranceType): string {
  return INSURANCE_TYPE_LABELS[type];
}
