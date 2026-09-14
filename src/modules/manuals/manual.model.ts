/**
 * Manuals domain types — vessel-linked manuals with revision history.
 *
 * No expiry engine / compliance status. Safe for client components.
 *
 * Spec: PROJECT_PLAN.md §8.
 */
import type { ManualRevisionRow, ManualRow } from "@/db/schema";

export type { ManualRevisionRow, ManualRow } from "@/db/schema";

/** List-row shape with vessel join + current revision summary. */
export type ManualListItem = ManualRow & {
  vesselName: string;
  currentRevision: ManualRevisionRow | null;
  revisionCount: number;
};

/** Detail shape with full revision history (newest upload first). */
export type ManualDetail = ManualListItem & {
  revisions: ManualRevisionRow[];
};
