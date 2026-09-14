/**
 * Reminders domain types and presentation helpers.
 *
 * User-set nudges — distinct from system Alerts. No expiry engine.
 *
 * Spec: PROJECT_PLAN.md §12.
 */
import type { StatusPillTone } from "@/components/ui/status-pill";
import {
  reminderPriorityEnum,
  reminderStatusEnum,
  reminderTypeEnum,
  type ReminderPriority,
  type ReminderRow,
  type ReminderStatus,
  type ReminderType,
} from "@/db/schema";

export type {
  ReminderPriority,
  ReminderRow,
  ReminderStatus,
  ReminderType,
} from "@/db/schema";

export const REMINDER_TYPES = reminderTypeEnum;
export const REMINDER_PRIORITIES = reminderPriorityEnum;
export const REMINDER_STATUSES = reminderStatusEnum;

/** List-row shape with optional vessel name (null for fleet-wide). */
export type ReminderListItem = ReminderRow & {
  vesselName: string | null;
};

export function reminderTypeLabel(type: ReminderType): string {
  if (type === "certificate") return "Certificate";
  if (type === "insurance") return "Insurance";
  if (type === "manual") return "Manual";
  if (type === "deficiency") return "Deficiency";
  return "Custom";
}

export function reminderPriorityLabel(priority: ReminderPriority): string {
  if (priority === "low") return "Low";
  if (priority === "high") return "High";
  return "Medium";
}

export function reminderStatusLabel(status: ReminderStatus): string {
  if (status === "done") return "Done";
  if (status === "dismissed") return "Dismissed";
  return "Pending";
}

/**
 * StatusPill tone for reminder status.
 * pending/dismissed → neutral, done → success.
 */
export function reminderStatusTone(status: ReminderStatus): StatusPillTone {
  if (status === "done") return "success";
  return "neutral";
}

/**
 * Optional badge tone for priority (not StatusPill compliance mode).
 * high → warning; low/medium → neutral.
 */
export function reminderPriorityTone(
  priority: ReminderPriority,
): StatusPillTone {
  if (priority === "high") return "warning";
  return "neutral";
}
