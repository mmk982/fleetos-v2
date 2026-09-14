/**
 * Deficiency domain types and presentation helpers.
 *
 * No DB access / no `server-only` — safe for client components. Status is a
 * stored domain enum (not ComplianceStatus); map it to StatusPill tones via
 * {@link deficiencyStatusTone}.
 *
 * Spec: PROJECT_PLAN.md §2.
 */
import {
  deficiencySourceEnum,
  deficiencyStatusEnum,
  type DeficiencyRow,
  type DeficiencyStatus,
} from "@/db/schema";
import type { StatusPillTone } from "@/components/ui/status-pill";

export type {
  DeficiencyAttachmentRow,
  DeficiencyRow,
  DeficiencySource,
  DeficiencyStatus,
} from "@/db/schema";

/** Source options for forms / filters. */
export const DEFICIENCY_SOURCES = deficiencySourceEnum;
/** Status options for forms / filters. */
export const DEFICIENCY_STATUSES = deficiencyStatusEnum;

/**
 * StatusPill tone mapping for the 4-state deficiency lifecycle.
 *
 * Urgency read: `open` is unresolved and needs attention (danger);
 * `in_progress` and `monitoring` are active work / watch states (warning —
 * still alertable per §0.7, not green); `closed` is done (success).
 */
export function deficiencyStatusTone(status: DeficiencyStatus): StatusPillTone {
  switch (status) {
    case "open":
      return "danger";
    case "in_progress":
    case "monitoring":
      return "warning";
    case "closed":
      return "success";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Human label for a deficiency status. */
export function deficiencyStatusLabel(status: DeficiencyStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "closed":
      return "Closed";
    case "monitoring":
      return "Monitoring";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Human label for a deficiency source. */
export function deficiencySourceLabel(source: string): string {
  switch (source) {
    case "psc":
      return "PSC";
    case "class":
      return "Class";
    case "flag":
      return "Flag";
    case "internal":
      return "Internal";
    case "other":
      return "Other";
    default:
      return source;
  }
}

/** List-row shape with vessel name (safe for client props). */
export type DeficiencyListItem = DeficiencyRow & {
  vesselName: string;
};
