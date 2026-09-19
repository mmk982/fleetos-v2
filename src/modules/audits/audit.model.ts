/**
 * Audit domain types and presentation helpers.
 *
 * No DB access / no `server-only` — safe for client components.
 * Standalone ISSC/MLC/SMC/DOC event log — no deficiency FK.
 */
import {
  auditTypeEnum,
  type AuditRow,
  type AuditType,
} from "@/db/schema";

export type { AuditRow, AuditType } from "@/db/schema";
export { auditTypeEnum };

/** Audit type options for forms / filters. */
export const AUDIT_TYPES = auditTypeEnum;

/** Human label — enum values are already short recognizable codes. */
export function auditTypeLabel(type: AuditType): string {
  return type;
}

/** List-row shape with vessel name (safe for client props). */
export type AuditListItem = AuditRow & {
  vesselName: string;
};
