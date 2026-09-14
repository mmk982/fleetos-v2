/**
 * Ship Particulars domain types — fleet summary + current/history detail.
 *
 * No expiry / compliance / StatusPill. Safe for client components.
 *
 * Spec: PROJECT_PLAN.md §13.
 */
import type {
  VesselParticularsAttachmentRow,
  VesselParticularsRow,
} from "@/db/schema";

export type {
  VesselNoteRow,
  VesselParticularsAttachmentRow,
  VesselParticularsRow,
} from "@/db/schema";

/** Fleet-wide summary: one row per vessel (left-joined to current particulars). */
export type ParticularsSummaryItem = {
  vesselId: string;
  vesselName: string;
  particularsId: string | null;
  classSociety: string | null;
  deadweightTonnage: number | null;
  lengthOverall: string | null;
  effectiveDate: string | null;
};

/** Current particulars record with attachments. */
export type ParticularsCurrentDetail = VesselParticularsRow & {
  vesselName: string;
  attachments: VesselParticularsAttachmentRow[];
};

/** Vessel particulars page payload: current + historical records. */
export type ParticularsVesselDetail = {
  vesselId: string;
  vesselName: string;
  current: ParticularsCurrentDetail | null;
  history: VesselParticularsRow[];
};
