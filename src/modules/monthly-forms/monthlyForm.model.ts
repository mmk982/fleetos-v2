/**
 * Monthly Executed Forms domain types and StatusPill tone helpers.
 *
 * Spec: PROJECT_PLAN.md §10.
 */
import type { StatusPillTone } from "@/components/ui/status-pill";
import type {
  MonthlyExecutedFormRow,
  MonthlyFormFrequency,
  MonthlyFormStatus,
} from "@/db/schema";
import type { MonthlyFormDisplayStatus } from "./monthly-form-status";

export type {
  MonthlyExecutedFormAttachmentRow,
  MonthlyExecutedFormRow,
  MonthlyFormFrequency,
  MonthlyFormRequirementRow,
  MonthlyFormStatus,
} from "@/db/schema";

export type { MonthlyFormDisplayStatus } from "./monthly-form-status";

export const MONTHLY_FORM_FREQUENCIES = [
  "monthly",
  "quarterly",
  "yearly",
  "on_demand",
] as const satisfies readonly MonthlyFormFrequency[];

export const MONTHLY_FORM_STATUSES = [
  "submitted",
  "pending",
] as const satisfies readonly MonthlyFormStatus[];

/** List-row shape with vessel join, derived display status, attachment count. */
export type MonthlyFormListItem = MonthlyExecutedFormRow & {
  vesselName: string;
  displayStatus: MonthlyFormDisplayStatus;
  attachmentCount: number;
};

/**
 * StatusPill tone for derived display status.
 * submitted → success, pending → neutral, overdue → danger.
 */
export function monthlyFormDisplayStatusTone(
  status: MonthlyFormDisplayStatus,
): StatusPillTone {
  if (status === "submitted") return "success";
  if (status === "overdue") return "danger";
  return "neutral";
}

export function monthlyFormDisplayStatusLabel(
  status: MonthlyFormDisplayStatus,
): string {
  if (status === "submitted") return "Submitted";
  if (status === "overdue") return "Overdue";
  return "Pending";
}

export function monthlyFormFrequencyLabel(
  frequency: MonthlyFormFrequency,
): string {
  if (frequency === "monthly") return "Monthly";
  if (frequency === "quarterly") return "Quarterly";
  if (frequency === "yearly") return "Yearly";
  return "On demand";
}

/** Requirement list row with vessel + template names for the admin table. */
export type MonthlyFormRequirementListItem = {
  id: string;
  vesselId: string;
  vesselName: string;
  ismTemplateId: string;
  templateName: string;
  formCode: string;
  frequency: MonthlyFormFrequency;
  activeStatus: boolean;
  createdAt: Date;
  updatedAt: Date;
};
