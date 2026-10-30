import "server-only";

import { and, asc, desc, eq, isNull, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, withDb } from "@/db/client";
import {
  certificateAttachments,
  certificateEvents,
  certificates,
  certificateTypes,
  issuingAuthorities,
  vessels,
  type CertificateAttachmentRow,
  type CertificateEventRow,
  type CertificateTypeRow,
  type IssuingAuthorityRow,
  type VesselRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  assertVesselScope,
  requireScopedVesselId,
  type AccessContext,
} from "@/lib/auth/access";
import { type ComplianceStatus } from "@/lib/expiry";
import type { CertificateListItem } from "./certificate.model";
import {
  CertificateNotFoundError,
  countChildCertificates,
  deriveForCertificate,
  mapCertificateListRows,
  selectCertificateListRows,
} from "./certificate.shared";
/** Detail shape including events and attachments. */
export type CertificateDetail = CertificateListItem & {
  events: CertificateEventRow[];
  attachments: CertificateAttachmentRow[];
  certificateType: CertificateTypeRow;
  issuingAuthority: IssuingAuthorityRow | null;
  vessel: VesselRow;
};

export type CertificateListFilters = {
  vesselId?: string;
  authority?: string;
  issuingAuthorityId?: string;
  /** Live engine status filter (applied after derive). */
  status?: ComplianceStatus;
};

/**
 * Lists certificates with vessel/type/issuer joins and live compliance status.
 *
 * @param filters - Optional vessel / authority / issuer / live-status filters.
 */
export async function listCertificates(
  ctx: AccessContext,
  filters: CertificateListFilters = {},
): Promise<CertificateListItem[]> {
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx);
    assertModuleAccess(ctx, "certificates", "read");
    const db = getDb();
  
    const scopedVesselId = requireScopedVesselId(ctx) ?? filters.vesselId;
  
    const conditions: SQL[] = [];
    if (scopedVesselId) {
      conditions.push(eq(certificates.vesselId, scopedVesselId));
    }
    if (filters.authority) {
      conditions.push(
        eq(certificateTypes.authority, filters.authority as CertificateTypeRow["authority"]),
      );
    }
    if (filters.issuingAuthorityId) {
      conditions.push(eq(certificates.issuingAuthorityId, filters.issuingAuthorityId));
    }
  
    const rows = await selectCertificateListRows(db, conditions);
    const items = await mapCertificateListRows(db, rows);
  
    if (filters.status) {
      return items.filter((item) => item.compliance.status === filters.status);
    }
    return items;
  
  });
}

export type ParentCertificateCandidate = {
  id: string;
  vesselId: string;
  typeName: string;
  certificateNumber: string | null;
};

/**
 * Lightweight top-level certificate options for the parent dropdown.
 * No compliance derivation, child counts, or pagination.
 */
export async function listParentCandidates(
  ctx: AccessContext,
): Promise<ParentCertificateCandidate[]> {
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx);
    assertModuleAccess(ctx, "certificates", "read");
    const db = getDb();
  
    const scopedVesselId = requireScopedVesselId(ctx);
    const conditions: SQL[] = [isNull(certificates.parentCertificateId)];
    if (scopedVesselId) {
      conditions.push(eq(certificates.vesselId, scopedVesselId));
    }
  
    return db
      .select({
        id: certificates.id,
        vesselId: certificates.vesselId,
        typeName: certificateTypes.name,
        certificateNumber: certificates.certificateNumber,
      })
      .from(certificates)
      .innerJoin(
        certificateTypes,
        eq(certificates.certificateTypeId, certificateTypes.id),
      )
      .innerJoin(vessels, eq(certificates.vesselId, vessels.id))
      .where(and(...conditions))
      .orderBy(asc(vessels.name), asc(certificateTypes.name));
  
  });
}

/**
 * Full certificate detail, or `undefined` if missing.
 */
export async function getCertificateById(
  ctx: AccessContext,
  id: string,
): Promise<CertificateDetail | undefined> {
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx, id);
    assertModuleAccess(ctx, "certificates", "read");
    const db = getDb();
  
    const parentCertificates = alias(certificates, "parent_certificates");
    const parentTypes = alias(certificateTypes, "parent_certificate_types");
  
    const rows = await db
      .select({
        certificate: certificates,
        vessel: vessels,
        certificateType: certificateTypes,
        issuingAuthority: issuingAuthorities,
        parentTypeName: parentTypes.name,
      })
      .from(certificates)
      .innerJoin(vessels, eq(certificates.vesselId, vessels.id))
      .innerJoin(
        certificateTypes,
        eq(certificates.certificateTypeId, certificateTypes.id),
      )
      .leftJoin(
        issuingAuthorities,
        eq(certificates.issuingAuthorityId, issuingAuthorities.id),
      )
      .leftJoin(
        parentCertificates,
        eq(certificates.parentCertificateId, parentCertificates.id),
      )
      .leftJoin(
        parentTypes,
        eq(parentCertificates.certificateTypeId, parentTypes.id),
      )
      .where(eq(certificates.id, id))
      .limit(1);
  
    const row = rows[0];
    if (!row) {
      return undefined;
    }
    assertVesselScope(ctx, row.certificate.vesselId);
  
    // Sequential on the withDb transaction client (pg forbids concurrent query).
    const events = await db
      .select()
      .from(certificateEvents)
      .where(eq(certificateEvents.certificateId, id))
      .orderBy(
        desc(certificateEvents.eventDate),
        desc(certificateEvents.createdAt),
      );
    const attachments = await db
      .select()
      .from(certificateAttachments)
      .where(eq(certificateAttachments.certificateId, id))
      .orderBy(desc(certificateAttachments.uploadedAt));
    const subItemCount = await countChildCertificates(id, db);
  
    const compliance = deriveForCertificate(row.certificate, row.certificateType);
  
    return {
      ...row.certificate,
      vesselName: row.vessel.name,
      typeName: row.certificateType.name,
      authority: row.certificateType.authority,
      ruleKind: row.certificateType.ruleKind,
      typeOffsetDays: row.certificateType.offsetDays,
      issuingAuthorityName: row.issuingAuthority?.name ?? null,
      parentCertificateName: row.parentTypeName ?? null,
      subItemCount,
      compliance,
      events,
      attachments,
      certificateType: row.certificateType,
      issuingAuthority: row.issuingAuthority,
      vessel: row.vessel,
    };
  
  });
}

/** @throws {CertificateNotFoundError} */
export async function requireCertificateById(
  ctx: AccessContext,
  id: string,
): Promise<CertificateDetail> {
  return withDb(ctx, async () => {
    const row = await getCertificateById(ctx, id);
    if (!row) {
      throw new CertificateNotFoundError(id);
    }
    return row;
  
  });
}

/**
 * Sub-items linked to a parent equipment certificate. Same RBAC as
 * {@link listCertificates}; additionally asserts vessel scope from the parent.
 * Filters in SQL via `parent_certificate_id` (shared select/join helper).
 */
export async function listSubCertificates(
  ctx: AccessContext,
  parentCertificateId: string,
): Promise<CertificateListItem[]> {
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx);
    assertModuleAccess(ctx, "certificates", "read");
    const parent = await requireCertificateById(ctx, parentCertificateId);
    assertVesselScope(ctx, parent.vesselId);
  
    const db = getDb();
    const scopedVesselId = requireScopedVesselId(ctx) ?? parent.vesselId;
    const conditions: SQL[] = [
      eq(certificates.parentCertificateId, parentCertificateId),
    ];
    if (scopedVesselId) {
      conditions.push(eq(certificates.vesselId, scopedVesselId));
    }
  
    const rows = await selectCertificateListRows(db, conditions);
    return mapCertificateListRows(db, rows);
  
  });
}
