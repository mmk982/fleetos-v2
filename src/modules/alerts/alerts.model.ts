/**
 * Alerts aggregator types and deficiency-only reminder rule.
 *
 * Pure derived feed — no table. Spec: PROJECT_PLAN.md §5.
 */
import type { ComplianceStatus } from "@/lib/expiry";

export type AlertKind =
  | "certificate"
  | "crew_certificate"
  | "insurance"
  | "deficiency";

export interface AlertItem {
  kind: AlertKind;
  id: string;
  title: string;
  vesselId: string | null;
  vesselName: string | null;
  subjectName: string | null;
  expiresAt: string | null;
  status: ComplianceStatus;
  daysRemaining: number | null;
  href: string;
}

/**
 * Alerts-feed-only rule for deficiencies with a due date.
 * Not part of the Deficiencies module — stored status is authoritative there.
 */
export const DEFICIENCY_ALERT_REMINDER_RULE = {
  kind: "expiry_offset" as const,
  offsetDays: 30,
};

export const ALERT_KINDS: readonly AlertKind[] = [
  "certificate",
  "crew_certificate",
  "insurance",
  "deficiency",
] as const;

export function alertKindLabel(kind: AlertKind): string {
  if (kind === "certificate") return "Certificate";
  if (kind === "crew_certificate") return "Crew certificate";
  if (kind === "insurance") return "Insurance";
  return "Deficiency";
}

/**
 * Parse the main-list status query param: one actionable status, or a
 * comma-separated set (e.g. `critical,expiring` — what the dashboard "Due
 * certs" card links to). Unknown tokens are ignored; nothing valid → default
 * (all actionable).
 */
export function parseAlertStatusFilter(
  raw: string | undefined,
): import("@/lib/expiry").ComplianceStatus[] | undefined {
  if (!raw) return undefined;
  const wanted = new Set(raw.split(",").map((s) => s.trim()));
  const statuses = (["expired", "critical", "expiring"] as const).filter((s) =>
    wanted.has(s),
  );
  return statuses.length > 0 ? statuses : undefined;
}
