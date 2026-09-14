/**
 * Drawings domain types — vessel-scoped technical drawings.
 *
 * No expiry engine / compliance status / lifecycle tone. Safe for client
 * components.
 *
 * Spec: PROJECT_PLAN.md §11.
 */
import type { DrawingRow } from "@/db/schema";

export type {
  DrawingAttachmentRow,
  DrawingCategoryRow,
  DrawingRow,
} from "@/db/schema";

/** List-row shape with vessel + category name joins. */
export type DrawingListItem = DrawingRow & {
  vesselName: string;
  categoryName: string;
};
