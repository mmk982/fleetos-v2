/**
 * PSC inspection domain types and presentation helpers.
 *
 * No DB access / no `server-only` — safe for client components.
 * Spec: PROJECT_PLAN.md §7b.
 */
import {
  pscInspectionResultEnum,
  type PscInspectionResult,
  type PscInspectionRow,
} from "@/db/schema";
import type { StatusPillTone } from "@/components/ui/status-pill";

export type { PscInspectionResult, PscInspectionRow } from "@/db/schema";
export { pscInspectionResultEnum };

/** Result options for forms / filters. */
export const PSC_INSPECTION_RESULTS = pscInspectionResultEnum;

/** Human label for a PSC inspection result. */
export function pscInspectionResultLabel(
  result: PscInspectionResult,
): string {
  switch (result) {
    case "no_deficiencies":
      return "No Deficiencies";
    case "deficiencies_noted":
      return "Deficiencies Noted";
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}

/**
 * StatusPill tone: detention escalates to danger; deficiencies noted →
 * warning; clean inspection → success.
 */
export function pscInspectionResultTone(
  result: PscInspectionResult,
  detained: boolean,
): StatusPillTone {
  if (detained) return "danger";
  if (result === "deficiencies_noted") return "warning";
  return "success";
}

/** List-row shape with vessel name (safe for client props). */
export type PscInspectionListItem = PscInspectionRow & {
  vesselName: string;
};
