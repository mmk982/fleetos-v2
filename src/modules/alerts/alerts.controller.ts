/**
 * Centralized alerts aggregator (`PROJECT_PLAN.md` §5).
 *
 * Pure derivation at read time across certificates, crew certificates,
 * insurance, and unresolved deficiencies. No alerts table.
 */
import "server-only";

import { and, eq, inArray, isNotNull, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  certificates,
  certificateTypes,
  crewCertificates,
  crewMembers,
  deficiencies,
  insurancePolicies,
  vessels,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  type AccessContext,
} from "@/lib/auth/access";
import {
  compareBySeverity,
  deriveComplianceStatus,
  isActionable,
  type ComplianceStatus,
} from "@/lib/expiry";
import { getCriticalDays } from "@/lib/settings/critical-days";
import { effectiveOffsetDays } from "@/modules/certificates/certificate.model";
import { CREW_CERTIFICATE_REMINDER_RULE } from "@/modules/crew/crew.model";
import {
  INSURANCE_REMINDER_RULE,
  insuranceTypeLabel,
} from "@/modules/insurance/insurance.model";
import {
  ALERT_KINDS,
  DEFICIENCY_ALERT_REMINDER_RULE,
  type AlertItem,
  type AlertKind,
} from "./alerts.model";

export type {
  AlertItem,
  AlertKind,
} from "./alerts.model";
export {
  ALERT_KINDS,
  DEFICIENCY_ALERT_REMINDER_RULE,
  alertKindLabel,
} from "./alerts.model";

export type GetAlertsOptions = {
  kinds?: AlertKind[];
  vesselId?: string;
  /** Default: actionable (`expiring` | `critical` | `expired`) via `isActionable`. */
  statuses?: ComplianceStatus[];
  limit?: number;
};

function wantsKind(kinds: AlertKind[] | undefined, kind: AlertKind): boolean {
  if (!kinds || kinds.length === 0) return true;
  return kinds.includes(kind);
}

function expiresAtForCertificate(
  ruleKind: string,
  expiryDate: string | null,
  windowOpenDate: string | null,
): string | null {
  if (ruleKind === "window") return windowOpenDate;
  return expiryDate;
}

async function loadCertificateAlerts(
  criticalDays: number,
  vesselId?: string,
): Promise<AlertItem[]> {
  const conditions: SQL[] = [eq(certificates.lifecycleStatus, "active")];
  if (vesselId) conditions.push(eq(certificates.vesselId, vesselId));

  const rows = await getDb()
    .select({
      id: certificates.id,
      vesselId: certificates.vesselId,
      vesselName: vessels.name,
      expiryDate: certificates.expiryDate,
      windowOpenDate: certificates.windowOpenDate,
      windowCloseDate: certificates.windowCloseDate,
      customOffsetDays: certificates.customOffsetDays,
      linkedToDryDock: certificates.linkedToDryDock,
      lifecycleStatus: certificates.lifecycleStatus,
      typeName: certificateTypes.name,
      ruleKind: certificateTypes.ruleKind,
      typeOffsetDays: certificateTypes.offsetDays,
    })
    .from(certificates)
    .innerJoin(
      certificateTypes,
      eq(certificates.certificateTypeId, certificateTypes.id),
    )
    .innerJoin(vessels, eq(certificates.vesselId, vessels.id))
    .where(and(...conditions));

  return rows.map((row) => {
    const offsetDays = effectiveOffsetDays(
      {
        customOffsetDays: row.customOffsetDays,
        linkedToDryDock: row.linkedToDryDock,
      },
      row.typeOffsetDays,
    );
    const compliance = deriveComplianceStatus({
      rule: { kind: row.ruleKind, offsetDays },
      expiryDate: row.expiryDate,
      windowOpenDate: row.windowOpenDate,
      windowCloseDate: row.windowCloseDate,
      lifecycleStatus: row.lifecycleStatus,
      criticalDays,
    });
    return {
      kind: "certificate" as const,
      id: row.id,
      title: row.typeName,
      vesselId: row.vesselId,
      vesselName: row.vesselName,
      subjectName: null,
      expiresAt: expiresAtForCertificate(
        row.ruleKind,
        row.expiryDate,
        row.windowOpenDate,
      ),
      status: compliance.status,
      daysRemaining: compliance.daysRemaining,
      href: `/dashboard/certificates/${row.id}`,
    };
  });
}

async function loadCrewCertificateAlerts(
  criticalDays: number,
  vesselId?: string,
): Promise<AlertItem[]> {
  const conditions: SQL[] = [];
  if (vesselId) conditions.push(eq(crewMembers.vesselId, vesselId));

  const rows = await getDb()
    .select({
      id: crewCertificates.id,
      name: crewCertificates.name,
      expiryDate: crewCertificates.expiryDate,
      crewMemberId: crewMembers.id,
      firstName: crewMembers.firstName,
      lastName: crewMembers.lastName,
      vesselId: crewMembers.vesselId,
      vesselName: vessels.name,
    })
    .from(crewCertificates)
    .innerJoin(
      crewMembers,
      eq(crewCertificates.crewMemberId, crewMembers.id),
    )
    .leftJoin(vessels, eq(crewMembers.vesselId, vessels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map((row) => {
    const compliance = deriveComplianceStatus({
      rule: CREW_CERTIFICATE_REMINDER_RULE,
      expiryDate: row.expiryDate,
      criticalDays,
    });
    const subjectName = `${row.firstName} ${row.lastName}`.trim();
    return {
      kind: "crew_certificate" as const,
      id: row.id,
      title: row.name,
      vesselId: row.vesselId,
      vesselName: row.vesselName,
      subjectName: subjectName.length > 0 ? subjectName : null,
      expiresAt: row.expiryDate,
      status: compliance.status,
      daysRemaining: compliance.daysRemaining,
      href: `/dashboard/crew/${row.crewMemberId}`,
    };
  });
}

async function loadInsuranceAlerts(
  criticalDays: number,
  vesselId?: string,
): Promise<AlertItem[]> {
  const conditions: SQL[] = [];
  if (vesselId) conditions.push(eq(insurancePolicies.vesselId, vesselId));

  const rows = await getDb()
    .select({
      id: insurancePolicies.id,
      policyType: insurancePolicies.policyType,
      expiryDate: insurancePolicies.expiryDate,
      vesselId: insurancePolicies.vesselId,
      vesselName: vessels.name,
    })
    .from(insurancePolicies)
    .innerJoin(vessels, eq(insurancePolicies.vesselId, vessels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map((row) => {
    const compliance = deriveComplianceStatus({
      rule: INSURANCE_REMINDER_RULE,
      expiryDate: row.expiryDate,
      criticalDays,
    });
    return {
      kind: "insurance" as const,
      id: row.id,
      title: insuranceTypeLabel(row.policyType),
      vesselId: row.vesselId,
      vesselName: row.vesselName,
      subjectName: null,
      expiresAt: row.expiryDate,
      status: compliance.status,
      daysRemaining: compliance.daysRemaining,
      href: `/dashboard/insurance/${row.id}`,
    };
  });
}

async function loadDeficiencyAlerts(
  criticalDays: number,
  vesselId?: string,
): Promise<AlertItem[]> {
  const conditions: SQL[] = [
    inArray(deficiencies.status, ["open", "in_progress", "monitoring"]),
    isNotNull(deficiencies.dueDate),
  ];
  if (vesselId) conditions.push(eq(deficiencies.vesselId, vesselId));

  const rows = await getDb()
    .select({
      id: deficiencies.id,
      title: deficiencies.title,
      dueDate: deficiencies.dueDate,
      vesselId: deficiencies.vesselId,
      vesselName: vessels.name,
    })
    .from(deficiencies)
    .innerJoin(vessels, eq(deficiencies.vesselId, vessels.id))
    .where(and(...conditions));

  return rows.map((row) => {
    const compliance = deriveComplianceStatus({
      rule: DEFICIENCY_ALERT_REMINDER_RULE,
      expiryDate: row.dueDate,
      criticalDays,
    });
    return {
      kind: "deficiency" as const,
      id: row.id,
      title: row.title,
      vesselId: row.vesselId,
      vesselName: row.vesselName,
      subjectName: null,
      expiresAt: row.dueDate,
      status: compliance.status,
      daysRemaining: compliance.daysRemaining,
      href: `/dashboard/deficiencies/${row.id}`,
    };
  });
}

/**
 * Unified actionable (or filtered) alerts feed across four source modules.
 *
 * @param ctx - Authenticated access context.
 * @param options - Optional kind / vessel / status / limit filters.
 */
export async function getAlerts(
  ctx: AccessContext,
  options: GetAlertsOptions = {},
): Promise<AlertItem[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "alerts", "read");

  const kinds = options.kinds?.filter((k) =>
    (ALERT_KINDS as readonly string[]).includes(k),
  );
  const vesselId =
    ctx.role === "management_user" || ctx.role === "vessel_user"
      ? (ctx.vesselId ?? undefined)
      : options.vesselId || undefined;
  const criticalDays = await getCriticalDays();

  const batches = await Promise.all([
    wantsKind(kinds, "certificate")
      ? loadCertificateAlerts(criticalDays, vesselId)
      : Promise.resolve([] as AlertItem[]),
    wantsKind(kinds, "crew_certificate")
      ? loadCrewCertificateAlerts(criticalDays, vesselId)
      : Promise.resolve([] as AlertItem[]),
    wantsKind(kinds, "insurance")
      ? loadInsuranceAlerts(criticalDays, vesselId)
      : Promise.resolve([] as AlertItem[]),
    wantsKind(kinds, "deficiency")
      ? loadDeficiencyAlerts(criticalDays, vesselId)
      : Promise.resolve([] as AlertItem[]),
  ]);

  let items = batches.flat();

  if (options.statuses && options.statuses.length > 0) {
    const allowed = new Set(options.statuses);
    items = items.filter((item) => allowed.has(item.status));
  } else {
    items = items.filter((item) => isActionable(item.status));
  }

  items.sort((a, b) =>
    compareBySeverity(
      {
        status: a.status,
        daysRemaining: a.daysRemaining,
        reference: "expiry",
      },
      {
        status: b.status,
        daysRemaining: b.daysRemaining,
        reference: "expiry",
      },
    ),
  );

  if (options.limit != null && options.limit >= 0) {
    items = items.slice(0, options.limit);
  }

  return items;
}
