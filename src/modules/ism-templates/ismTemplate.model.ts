/**
 * ISM Template domain types and presentation helpers.
 *
 * Fleet-wide blank forms — no vessel join, no expiry/compliance. Status is
 * a lifecycle enum rendered with StatusPill `tone` (not compliance mode).
 *
 * Spec: PROJECT_PLAN.md §9.
 */
import {
  ismTemplateStatusEnum,
  type IsmTemplateRow,
  type IsmTemplateStatus,
} from "@/db/schema";
import type { StatusPillTone } from "@/components/ui/status-pill";

export type {
  IsmTemplateAttachmentRow,
  IsmTemplateCategoryRow,
  IsmTemplateRow,
  IsmTemplateStatus,
} from "@/db/schema";

/** List-row shape with category name join (safe for client props). */
export type IsmTemplateListItem = IsmTemplateRow & {
  categoryName: string;
};

export const ISM_TEMPLATE_STATUSES = ismTemplateStatusEnum;

/**
 * StatusPill tone for template lifecycle.
 * active → success, draft → neutral, superseded → warning.
 */
export function ismTemplateStatusTone(
  status: IsmTemplateStatus,
): StatusPillTone {
  if (status === "active") return "success";
  if (status === "draft") return "neutral";
  return "warning";
}

export function ismTemplateStatusLabel(status: IsmTemplateStatus): string {
  if (status === "active") return "Active";
  if (status === "draft") return "Draft";
  return "Superseded";
}
