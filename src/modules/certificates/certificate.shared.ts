/**
 * Internal helpers shared by the certificate controller modules
 * (`certificate.lookups|queries|mutations|events|attachments.ts`).
 * Not part of the public API — import from `./certificate.controller`.
 */
import { businessCriticalDays, businessNow } from "@/lib/settings/business-time";
import "server-only";

import { and, asc, count, eq, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import {
  certificates,
  certificateTypes,
  issuingAuthorities,
  vessels,
  type CertificateRow,
  type CertificateTypeRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertVesselScope,
  type AccessContext,
} from "@/lib/auth/access";
import {
  deriveComplianceStatus,
  type ComplianceResult,
  type ComplianceStatus,
} from "@/lib/expiry";
import {
  effectiveOffsetDays,
  type CertificateListItem,
} from "./certificate.model";
export class CertificateNotFoundError extends Error {
  readonly code = "CERTIFICATE_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Certificate not found: ${id}`);
    this.name = "CertificateNotFoundError";
  }
}

export class CertificateTypeNotFoundError extends Error {
  readonly code = "CERTIFICATE_TYPE_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Certificate type not found: ${id}`);
    this.name = "CertificateTypeNotFoundError";
  }
}

export class IssuingAuthorityNotFoundError extends Error {
  readonly code = "ISSUING_AUTHORITY_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Issuing authority not found: ${id}`);
    this.name = "IssuingAuthorityNotFoundError";
  }
}

export class CertificateConflictError extends Error {
  readonly code = "CERTIFICATE_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "CertificateConflictError";
  }
}

export class AttachmentValidationError extends Error {
  readonly code = "ATTACHMENT_VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

export class AttachmentNotFoundError extends Error {
  readonly code = "ATTACHMENT_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Attachment not found: ${id}`);
    this.name = "AttachmentNotFoundError";
  }
}

export function deriveForCertificate(
  cert: CertificateRow,
  type: Pick<CertificateTypeRow, "ruleKind" | "offsetDays">,
): ComplianceResult {
  const offsetDays = effectiveOffsetDays(cert, type.offsetDays);
  return deriveComplianceStatus({
    now: businessNow(),
    criticalDays: businessCriticalDays(),
    rule: { kind: type.ruleKind, offsetDays },
    expiryDate: cert.expiryDate,
    windowOpenDate: cert.windowOpenDate,
    windowCloseDate: cert.windowCloseDate,
    lifecycleStatus: cert.lifecycleStatus,
  });
}

export async function loadType(
  ctx: AccessContext,
  id: string,
): Promise<CertificateTypeRow> {
  assertAuthenticatedAccess(ctx);
  const rows = await getDb()
    .select()
    .from(certificateTypes)
    .where(eq(certificateTypes.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new CertificateTypeNotFoundError(id);
  }
  return row;
}

export type AppDb = ReturnType<typeof getDb>;
export type AppTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
export type DbExecutor = AppDb | AppTx;

export type CertificateListJoinRow = {
  certificate: CertificateRow;
  vesselName: string;
  typeName: string;
  authority: CertificateTypeRow["authority"];
  ruleKind: CertificateTypeRow["ruleKind"];
  typeOffsetDays: number | null;
  issuingAuthorityName: string | null;
  parentTypeName: string | null;
};

/**
 * Counts certificates that list `certificateId` as their parent.
 * Shared by {@link assertValidParentLink} and the vessel-reassignment guard
 * in {@link updateCertificate} — don't duplicate the query inline twice.
 */
export async function countChildCertificates(
  certificateId: string,
  db: DbExecutor = getDb(),
): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(certificates)
    .where(eq(certificates.parentCertificateId, certificateId));
  return Number(rows[0]?.n ?? 0);
}

/**
 * Shared select/join used by {@link listCertificates} and
 * {@link listSubCertificates}. Callers own RBAC and WHERE conditions.
 */
export async function selectCertificateListRows(
  db: DbExecutor,
  conditions: SQL[],
): Promise<CertificateListJoinRow[]> {
  const parentCertificates = alias(certificates, "parent_certificates");
  const parentTypes = alias(certificateTypes, "parent_certificate_types");

  return db
    .select({
      certificate: certificates,
      vesselName: vessels.name,
      typeName: certificateTypes.name,
      authority: certificateTypes.authority,
      ruleKind: certificateTypes.ruleKind,
      typeOffsetDays: certificateTypes.offsetDays,
      issuingAuthorityName: issuingAuthorities.name,
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(vessels.name), asc(certificateTypes.name));
}

export async function mapCertificateListRows(
  db: DbExecutor,
  rows: CertificateListJoinRow[],
): Promise<CertificateListItem[]> {
  const parentIds = rows
    .map((row) => row.certificate.id)
    .filter((id, index, all) => all.indexOf(id) === index);

  const countRows =
    parentIds.length === 0
      ? []
      : await db
          .select({
            parentCertificateId: certificates.parentCertificateId,
            n: count(),
          })
          .from(certificates)
          .where(inArray(certificates.parentCertificateId, parentIds))
          .groupBy(certificates.parentCertificateId);

  const countByParent = new Map<string, number>();
  for (const row of countRows) {
    if (row.parentCertificateId) {
      countByParent.set(row.parentCertificateId, Number(row.n));
    }
  }

  return rows.map((row) =>
    toListItem(row.certificate, {
      vesselName: row.vesselName,
      typeName: row.typeName,
      authority: row.authority,
      ruleKind: row.ruleKind,
      typeOffsetDays: row.typeOffsetDays,
      issuingAuthorityName: row.issuingAuthorityName,
      parentCertificateName: row.parentTypeName ?? null,
      subItemCount: countByParent.get(row.certificate.id) ?? 0,
    }),
  );
}

/**
 * Loads and validates a parent certificate for a create/update.
 * One level only: the parent must be on the same vessel and must not
 * itself be a sub-item. Locks the parent row (`FOR UPDATE`) when called
 * inside a transaction so concurrent nesting edits cannot race.
 *
 * @throws {CertificateNotFoundError}
 * @throws {CertificateConflictError}
 */
export async function assertValidParentLink(
  db: DbExecutor,
  ctx: AccessContext,
  parentCertificateId: string,
  vesselId: string,
  selfId?: string,
): Promise<void> {
  if (selfId && parentCertificateId === selfId) {
    throw new CertificateConflictError(
      "A certificate cannot be its own parent.",
    );
  }
  const parentRows = await db
    .select()
    .from(certificates)
    .where(eq(certificates.id, parentCertificateId))
    .for("update")
    .limit(1);
  const parent = parentRows[0];
  if (!parent) {
    throw new CertificateNotFoundError(parentCertificateId);
  }
  assertVesselScope(ctx, parent.vesselId);
  if (parent.vesselId !== vesselId) {
    throw new CertificateConflictError(
      "Parent certificate must belong to the same vessel.",
    );
  }
  if (parent.parentCertificateId) {
    throw new CertificateConflictError(
      "Parent certificate is itself a sub-item; nesting is limited to one level.",
    );
  }
  if (selfId) {
    const childCount = await countChildCertificates(selfId, db);
    if (childCount > 0) {
      throw new CertificateConflictError(
        "A certificate with sub-items cannot itself become a sub-item.",
      );
    }
  }
}

export function toListItem(
  certificate: CertificateRow,
  extras: {
    vesselName: string;
    typeName: string;
    authority: CertificateTypeRow["authority"];
    ruleKind: CertificateTypeRow["ruleKind"];
    typeOffsetDays: number | null;
    issuingAuthorityName: string | null;
    parentCertificateName: string | null;
    subItemCount: number;
  },
): CertificateListItem {
  const compliance = deriveForCertificate(certificate, {
    ruleKind: extras.ruleKind,
    offsetDays: extras.typeOffsetDays,
  });
  return {
    ...certificate,
    vesselName: extras.vesselName,
    typeName: extras.typeName,
    authority: extras.authority,
    ruleKind: extras.ruleKind,
    typeOffsetDays: extras.typeOffsetDays,
    issuingAuthorityName: extras.issuingAuthorityName,
    parentCertificateName: extras.parentCertificateName,
    subItemCount: extras.subItemCount,
    compliance,
  };
}

/** Recomputes and persists non-authoritative `cachedStatus`. */
export async function refreshCachedStatus(
  ctx: AccessContext,
  cert: CertificateRow,
  type: Pick<CertificateTypeRow, "ruleKind" | "offsetDays">,
): Promise<ComplianceStatus> {
  assertAuthenticatedAccess(ctx);
  const compliance = deriveForCertificate(cert, type);
  await getDb()
    .update(certificates)
    .set({ cachedStatus: compliance.status, updatedAt: new Date() })
    .where(eq(certificates.id, cert.id));
  return compliance.status;
}
