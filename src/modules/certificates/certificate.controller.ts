/**
 * Certificate data-access layer.
 *
 * Only file in this module allowed to import drizzle-orm query builders.
 * Every public method takes {@link AccessContext} and calls
 * {@link assertAuthenticatedAccess}, then {@link assertModuleAccess} /
 * {@link assertVesselScope} as needed. Live status always comes from
 * `deriveComplianceStatus` — `cachedStatus` is a non-authoritative write-side cache.
 *
 * Spec: PROJECT_PLAN.md §1.
 */
import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import {
  certificateAttachments,
  certificateEvents,
  certificates,
  certificateTypes,
  issuingAuthorities,
  vessels,
  type CertificateAttachmentRow,
  type CertificateEventRow,
  type CertificateRow,
  type CertificateAuthority,
  type CertificateTypeRow,
  type IssuingAuthorityRow,
  type ReminderRuleKind,
  type VesselRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  assertVesselScope,
  requireScopedVesselId,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import {
  openStoredAttachmentStream,
  removeStoredAttachmentFile,
} from "@/lib/attachments/stream";
import {
  deriveComplianceStatus,
  type ComplianceResult,
  type ComplianceStatus,
} from "@/lib/expiry";
import { logError } from "@/lib/logging";
import {
  effectiveOffsetDays,
  type CertificateListItem,
} from "./certificate.model";
import type {
  CertificateCreateInput,
  CertificateEventCreateInput,
  CertificateUpdateInput,
} from "./validation";

export type { CertificateListItem } from "./certificate.model";

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

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

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

function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

function isPgForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

function deriveForCertificate(
  cert: CertificateRow,
  type: Pick<CertificateTypeRow, "ruleKind" | "offsetDays">,
): ComplianceResult {
  const offsetDays = effectiveOffsetDays(cert, type.offsetDays);
  return deriveComplianceStatus({
    rule: { kind: type.ruleKind, offsetDays },
    expiryDate: cert.expiryDate,
    windowOpenDate: cert.windowOpenDate,
    windowCloseDate: cert.windowCloseDate,
    lifecycleStatus: cert.lifecycleStatus,
  });
}

async function loadType(
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

/**
 * Counts certificates that list `certificateId` as their parent.
 * Shared by {@link assertValidParentLink} and the vessel-reassignment guard
 * in {@link updateCertificate} — don't duplicate the query inline twice.
 */
async function countChildCertificates(certificateId: string): Promise<number> {
  const rows = await getDb()
    .select({ n: count() })
    .from(certificates)
    .where(eq(certificates.parentCertificateId, certificateId));
  return Number(rows[0]?.n ?? 0);
}

/**
 * Loads and validates a parent certificate for a create/update.
 * One level only: the parent must be on the same vessel and must not
 * itself be a sub-item.
 *
 * @throws {CertificateNotFoundError}
 * @throws {CertificateConflictError}
 */
async function assertValidParentLink(
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
  const parent = await requireCertificateById(ctx, parentCertificateId);
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
    const childCount = await countChildCertificates(selfId);
    if (childCount > 0) {
      throw new CertificateConflictError(
        "A certificate with sub-items cannot itself become a sub-item.",
      );
    }
  }
}

function toListItem(
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
async function refreshCachedStatus(
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

/** Certificate types for form dropdowns, grouped by authority at the UI layer. */
export async function listCertificateTypes(
  ctx: AccessContext,
): Promise<CertificateTypeRow[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "certificates", "read");
  return getDb()
    .select()
    .from(certificateTypes)
    .orderBy(asc(certificateTypes.authority), asc(certificateTypes.name));
}

/** Issuing authorities for form dropdowns / filters. */
export async function listIssuingAuthorities(
  ctx: AccessContext,
): Promise<IssuingAuthorityRow[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "certificates", "read");
  return getDb()
    .select()
    .from(issuingAuthorities)
    .orderBy(asc(issuingAuthorities.name));
}

export async function createIssuingAuthority(
  ctx: AccessContext,
  input: { name: string },
): Promise<IssuingAuthorityRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "settings_general", "write");
  const name = input.name.trim();
  if (name.length === 0) {
    throw new CertificateConflictError("Name is required.");
  }
  const db = getDb();
  try {
    const inserted = await db
      .insert(issuingAuthorities)
      .values({ name, isCustom: true })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("Issuing authority insert did not return a row");
    return row;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new CertificateConflictError(
        "An issuing authority with that name already exists.",
      );
    }
    logError("ISSUING_AUTHORITY_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateIssuingAuthority(
  ctx: AccessContext,
  id: string,
  input: { name: string },
): Promise<IssuingAuthorityRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "settings_general", "write");
  const name = input.name.trim();
  if (name.length === 0) {
    throw new CertificateConflictError("Name is required.");
  }
  const db = getDb();
  const existing = await db
    .select({ id: issuingAuthorities.id })
    .from(issuingAuthorities)
    .where(eq(issuingAuthorities.id, id))
    .limit(1);
  if (!existing[0]) throw new IssuingAuthorityNotFoundError(id);

  try {
    const updated = await db
      .update(issuingAuthorities)
      .set({ name })
      .where(eq(issuingAuthorities.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new IssuingAuthorityNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof IssuingAuthorityNotFoundError) throw error;
    if (isPgUniqueViolation(error)) {
      throw new CertificateConflictError(
        "An issuing authority with that name already exists.",
      );
    }
    logError("ISSUING_AUTHORITY_UPDATE_FAILED", {
      error,
      issuingAuthorityId: id,
    });
    throw error;
  }
}

export async function deleteIssuingAuthority(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "settings_general", "write");
  const db = getDb();
  try {
    const deleted = await db
      .delete(issuingAuthorities)
      .where(eq(issuingAuthorities.id, id))
      .returning({ id: issuingAuthorities.id });
    if (deleted.length === 0) throw new IssuingAuthorityNotFoundError(id);
  } catch (error) {
    if (error instanceof IssuingAuthorityNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new CertificateConflictError(
        "Cannot delete: this issuing authority is still referenced by certificates.",
      );
    }
    logError("ISSUING_AUTHORITY_DELETE_FAILED", {
      error,
      issuingAuthorityId: id,
    });
    throw error;
  }
}

export async function createCertificateType(
  ctx: AccessContext,
  input: {
    authority: CertificateAuthority;
    name: string;
    ruleKind?: ReminderRuleKind;
    offsetDays?: number | null;
  },
): Promise<CertificateTypeRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "settings_general", "write");
  const name = input.name.trim();
  if (name.length === 0) {
    throw new CertificateConflictError("Name is required.");
  }
  const db = getDb();
  try {
    const inserted = await db
      .insert(certificateTypes)
      .values({
        authority: input.authority,
        name,
        ruleKind: input.ruleKind ?? "expiry_offset",
        offsetDays: input.offsetDays ?? null,
        isCustom: true,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("Certificate type insert did not return a row");
    return row;
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      throw new CertificateConflictError(
        "A certificate type with that authority and name already exists.",
      );
    }
    logError("CERTIFICATE_TYPE_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateCertificateType(
  ctx: AccessContext,
  id: string,
  input: {
    name?: string;
    authority?: CertificateAuthority;
    ruleKind?: ReminderRuleKind;
    offsetDays?: number | null;
  },
): Promise<CertificateTypeRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "settings_general", "write");
  const db = getDb();
  const existing = await db
    .select({ id: certificateTypes.id })
    .from(certificateTypes)
    .where(eq(certificateTypes.id, id))
    .limit(1);
  if (!existing[0]) throw new CertificateTypeNotFoundError(id);

  const patch: Partial<typeof certificateTypes.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length === 0) {
      throw new CertificateConflictError("Name is required.");
    }
    patch.name = name;
  }
  if (input.authority !== undefined) patch.authority = input.authority;
  if (input.ruleKind !== undefined) patch.ruleKind = input.ruleKind;
  if (input.offsetDays !== undefined) patch.offsetDays = input.offsetDays;

  try {
    const updated = await db
      .update(certificateTypes)
      .set(patch)
      .where(eq(certificateTypes.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new CertificateTypeNotFoundError(id);
    return row;
  } catch (error) {
    if (error instanceof CertificateTypeNotFoundError) throw error;
    if (isPgUniqueViolation(error)) {
      throw new CertificateConflictError(
        "A certificate type with that authority and name already exists.",
      );
    }
    logError("CERTIFICATE_TYPE_UPDATE_FAILED", {
      error,
      certificateTypeId: id,
    });
    throw error;
  }
}

export async function deleteCertificateType(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "settings_general", "write");
  const db = getDb();
  try {
    const deleted = await db
      .delete(certificateTypes)
      .where(eq(certificateTypes.id, id))
      .returning({ id: certificateTypes.id });
    if (deleted.length === 0) throw new CertificateTypeNotFoundError(id);
  } catch (error) {
    if (error instanceof CertificateTypeNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new CertificateConflictError(
        "Cannot delete: this certificate type is still referenced by certificates.",
      );
    }
    logError("CERTIFICATE_TYPE_DELETE_FAILED", {
      error,
      certificateTypeId: id,
    });
    throw error;
  }
}

/**
 * Lists certificates with vessel/type/issuer joins and live compliance status.
 *
 * @param filters - Optional vessel / authority / issuer / live-status filters.
 */
export async function listCertificates(
  ctx: AccessContext,
  filters: CertificateListFilters = {},
): Promise<CertificateListItem[]> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "certificates", "read");
  const db = getDb();

  const scopedVesselId = requireScopedVesselId(ctx) ?? filters.vesselId;
  const parentCertificates = alias(certificates, "parent_certificates");
  const parentTypes = alias(certificateTypes, "parent_certificate_types");

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

  const rows = await db
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

  const items: CertificateListItem[] = rows.map((row) =>
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

  if (filters.status) {
    return items.filter((item) => item.compliance.status === filters.status);
  }
  return items;
}

/**
 * Full certificate detail, or `undefined` if missing.
 */
export async function getCertificateById(
  ctx: AccessContext,
  id: string,
): Promise<CertificateDetail | undefined> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "certificates", "read");
  const db = getDb();

  const rows = await db
    .select({
      certificate: certificates,
      vessel: vessels,
      certificateType: certificateTypes,
      issuingAuthority: issuingAuthorities,
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
    .where(eq(certificates.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return undefined;
  }
  assertVesselScope(ctx, row.certificate.vesselId);

  const [events, attachments] = await Promise.all([
    db
      .select()
      .from(certificateEvents)
      .where(eq(certificateEvents.certificateId, id))
      .orderBy(desc(certificateEvents.eventDate), desc(certificateEvents.createdAt)),
    db
      .select()
      .from(certificateAttachments)
      .where(eq(certificateAttachments.certificateId, id))
      .orderBy(desc(certificateAttachments.uploadedAt)),
  ]);

  const compliance = deriveForCertificate(row.certificate, row.certificateType);

  return {
    ...row.certificate,
    vesselName: row.vessel.name,
    typeName: row.certificateType.name,
    authority: row.certificateType.authority,
    ruleKind: row.certificateType.ruleKind,
    typeOffsetDays: row.certificateType.offsetDays,
    issuingAuthorityName: row.issuingAuthority?.name ?? null,
    parentCertificateName: null,
    subItemCount: 0,
    compliance,
    events,
    attachments,
    certificateType: row.certificateType,
    issuingAuthority: row.issuingAuthority,
    vessel: row.vessel,
  };
}

/** @throws {CertificateNotFoundError} */
export async function requireCertificateById(
  ctx: AccessContext,
  id: string,
): Promise<CertificateDetail> {
  const row = await getCertificateById(ctx, id);
  if (!row) {
    throw new CertificateNotFoundError(id);
  }
  return row;
}

/**
 * Sub-items linked to a parent equipment certificate. Same RBAC as
 * {@link listCertificates}; additionally asserts vessel scope from the parent.
 */
export async function listSubCertificates(
  ctx: AccessContext,
  parentCertificateId: string,
): Promise<CertificateListItem[]> {
  const parent = await requireCertificateById(ctx, parentCertificateId);
  assertVesselScope(ctx, parent.vesselId);
  const rows = await listCertificates(ctx, { vesselId: parent.vesselId });
  return rows.filter((row) => row.parentCertificateId === parentCertificateId);
}

/**
 * Creates a certificate and writes `cachedStatus` from the engine.
 *
 * @throws {CertificateTypeNotFoundError}
 * @throws {CertificateConflictError} on FK / unique violations
 */
export async function createCertificate(
  ctx: AccessContext,
  input: CertificateCreateInput,
): Promise<CertificateRow> {
  assertAuthenticatedAccess(ctx);
  assertModuleAccess(ctx, "certificates", "write");
  assertVesselScope(ctx, input.vesselId);
  const type = await loadType(ctx, input.certificateTypeId);
  if (input.parentCertificateId) {
    await assertValidParentLink(
      ctx,
      input.parentCertificateId,
      input.vesselId,
    );
  }
  const db = getDb();
  let result: CertificateRow;

  try {
    const inserted = await db
      .insert(certificates)
      .values({
        vesselId: input.vesselId,
        certificateTypeId: input.certificateTypeId,
        parentCertificateId: input.parentCertificateId ?? null,
        certificateNumber: input.certificateNumber ?? null,
        issuingAuthorityId: input.issuingAuthorityId ?? null,
        issueDate: input.issueDate ?? null,
        expiryDate: input.expiryDate ?? null,
        windowOpenDate: input.windowOpenDate ?? null,
        windowCloseDate: input.windowCloseDate ?? null,
        linkedToDryDock: input.linkedToDryDock,
        customOffsetDays: input.customOffsetDays ?? null,
        lifecycleStatus: input.lifecycleStatus,
        remarks: input.remarks ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) {
      throw new Error("Insert did not return a row");
    }
    await refreshCachedStatus(ctx, row, type);
    const refreshed = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, row.id))
      .limit(1);
    result = refreshed[0] ?? row;
  } catch (error) {
    if (
      error instanceof CertificateTypeNotFoundError ||
      error instanceof CertificateConflictError ||
      error instanceof CertificateNotFoundError
    ) {
      throw error;
    }
    if (isPgForeignKeyViolation(error)) {
      throw new CertificateConflictError(
        "Vessel, certificate type, or issuing authority reference is invalid.",
      );
    }
    if (isPgUniqueViolation(error)) {
      throw new CertificateConflictError("Certificate conflicts with an existing row.");
    }
    logError("CERTIFICATE_CREATE_FAILED", {
      error,
      vesselId: input.vesselId,
      certificateTypeId: input.certificateTypeId,
    });
    throw error;
  }
  const label =
    type.name || result.certificateNumber || "certificate";
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "created",
    moduleName: "certificate",
    recordId: result.id,
    description: `Added certificate: ${label}`,
  });
  return result;
}

/**
 * Partial update; recomputes `cachedStatus` afterward.
 *
 * @throws {CertificateNotFoundError}
 */
export async function updateCertificate(
  ctx: AccessContext,
  id: string,
  input: CertificateUpdateInput,
): Promise<CertificateRow> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "certificates", "write");
  const db = getDb();
  const existing = await db
    .select()
    .from(certificates)
    .where(eq(certificates.id, id))
    .limit(1);
  if (!existing[0]) {
    throw new CertificateNotFoundError(id);
  }
  assertVesselScope(ctx, existing[0].vesselId);

  const nextVesselId = input.vesselId ?? existing[0].vesselId;
  if (nextVesselId !== existing[0].vesselId) {
    assertVesselScope(ctx, nextVesselId);

    const keepsExistingParentLink =
      existing[0].parentCertificateId !== null &&
      input.parentCertificateId === undefined;
    if (keepsExistingParentLink) {
      throw new CertificateConflictError(
        "Certificate is linked to a parent on the current vessel — unlink it (set parentCertificateId to null) or move both certificates together.",
      );
    }

    const childCount = await countChildCertificates(id);
    if (childCount > 0) {
      throw new CertificateConflictError(
        "Certificate has linked sub-items on the current vessel — unlink or move them first.",
      );
    }
  }
  if (input.parentCertificateId) {
    await assertValidParentLink(
      ctx,
      input.parentCertificateId,
      nextVesselId,
      id,
    );
  }

  const patch: Partial<typeof certificates.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.certificateTypeId !== undefined) {
    patch.certificateTypeId = input.certificateTypeId;
  }
  if (input.parentCertificateId !== undefined) {
    patch.parentCertificateId = input.parentCertificateId;
  }
  if (input.issuingAuthorityId !== undefined) {
    patch.issuingAuthorityId = input.issuingAuthorityId;
  }
  if (input.certificateNumber !== undefined) {
    patch.certificateNumber = input.certificateNumber;
  }
  if (input.issueDate !== undefined) patch.issueDate = input.issueDate;
  if (input.expiryDate !== undefined) patch.expiryDate = input.expiryDate;
  if (input.windowOpenDate !== undefined) {
    patch.windowOpenDate = input.windowOpenDate;
  }
  if (input.windowCloseDate !== undefined) {
    patch.windowCloseDate = input.windowCloseDate;
  }
  if (input.linkedToDryDock !== undefined) {
    patch.linkedToDryDock = input.linkedToDryDock;
  }
  if (input.customOffsetDays !== undefined) {
    patch.customOffsetDays = input.customOffsetDays;
  }
  if (input.lifecycleStatus !== undefined) {
    patch.lifecycleStatus = input.lifecycleStatus;
  }
  if (input.remarks !== undefined) patch.remarks = input.remarks;

  let result: CertificateRow;
  let typeName: string | undefined;
  try {
    const updated = await db
      .update(certificates)
      .set(patch)
      .where(eq(certificates.id, id))
      .returning();
    const row = updated[0];
    if (!row) {
      throw new CertificateNotFoundError(id);
    }
    const type = await loadType(ctx, row.certificateTypeId);
    typeName = type.name;
    await refreshCachedStatus(ctx, row, type);
    const refreshed = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id))
      .limit(1);
    result = refreshed[0] ?? row;
  } catch (error) {
    if (
      error instanceof CertificateNotFoundError ||
      error instanceof CertificateTypeNotFoundError ||
      error instanceof CertificateConflictError
    ) {
      throw error;
    }
    if (isPgForeignKeyViolation(error)) {
      throw new CertificateConflictError(
        "Vessel, certificate type, or issuing authority reference is invalid.",
      );
    }
    logError("CERTIFICATE_UPDATE_FAILED", { error, certificateId: id });
    throw error;
  }
  const label =
    typeName || result.certificateNumber || "certificate";
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "updated",
    moduleName: "certificate",
    recordId: result.id,
    description: `Updated certificate: ${label}`,
  });
  return result;
}

/**
 * Hard-deletes a certificate (mistake cleanup only — normal path uses revoke).
 * Events/attachments cascade at the DB.
 *
 * @throws {CertificateNotFoundError}
 */
export async function deleteCertificate(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  assertModuleAccess(ctx, "certificates", "write");
  const db = getDb();
  const existingRows = await db
    .select({
      vesselId: certificates.vesselId,
      certificateNumber: certificates.certificateNumber,
      typeName: certificateTypes.name,
    })
    .from(certificates)
    .leftJoin(
      certificateTypes,
      eq(certificates.certificateTypeId, certificateTypes.id),
    )
    .where(eq(certificates.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (existing) {
    assertVesselScope(ctx, existing.vesselId);
  }
  const label =
    existing?.typeName || existing?.certificateNumber || "certificate";
  try {
    const atts = await db
      .select()
      .from(certificateAttachments)
      .where(eq(certificateAttachments.certificateId, id));
    for (const att of atts) {
      await removeStoredAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(certificates)
      .where(eq(certificates.id, id))
      .returning({ id: certificates.id });
    if (deleted.length === 0) {
      throw new CertificateNotFoundError(id);
    }
  } catch (error) {
    if (error instanceof CertificateNotFoundError) {
      throw error;
    }
    logError("CERTIFICATE_DELETE_FAILED", { error, certificateId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "certificate",
    recordId: id,
    description: `Deleted certificate: ${label}`,
  });
}

/**
 * Adds a history event. `extended`/`renewed` push `expiryDate`;
 * `revoked` sets `lifecycleStatus`. Then recomputes `cachedStatus`.
 */
export async function addCertificateEvent(
  ctx: AccessContext,
  input: CertificateEventCreateInput,
): Promise<CertificateEventRow> {
  assertAuthenticatedAccess(ctx, input.certificateId);
  assertModuleAccess(ctx, "certificates", "write");
  const db = getDb();

  try {
    const certRows = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, input.certificateId))
      .limit(1);
    const cert = certRows[0];
    if (!cert) {
      throw new CertificateNotFoundError(input.certificateId);
    }
    assertVesselScope(ctx, cert.vesselId);

    const inserted = await db
      .insert(certificateEvents)
      .values({
        certificateId: input.certificateId,
        eventType: input.eventType,
        eventDate: input.eventDate,
        newExpiryDate: input.newExpiryDate ?? null,
        note: input.note ?? null,
      })
      .returning();
    const event = inserted[0];
    if (!event) {
      throw new Error("Event insert did not return a row");
    }

    const patch: Partial<typeof certificates.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (
      (input.eventType === "extended" || input.eventType === "renewed") &&
      input.newExpiryDate
    ) {
      patch.expiryDate = input.newExpiryDate;
    }
    if (input.eventType === "revoked") {
      patch.lifecycleStatus = "revoked";
    }

    const updated = await db
      .update(certificates)
      .set(patch)
      .where(eq(certificates.id, cert.id))
      .returning();
    const next = updated[0] ?? cert;
    const type = await loadType(ctx, next.certificateTypeId);
    await refreshCachedStatus(ctx, next, type);
    return event;
  } catch (error) {
    if (error instanceof CertificateNotFoundError) {
      throw error;
    }
    logError("CERTIFICATE_EVENT_FAILED", {
      error,
      certificateId: input.certificateId,
    });
    throw error;
  }
}

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

async function removeAttachmentFile(relativePath: string): Promise<void> {
  await removeStoredAttachmentFile(relativePath);
}

/**
 * Stores an uploaded file under `data/attachments/` with a generated name
 * (never derived from the user-supplied filename — SECURITY_PLAN.md §6).
 */
export async function uploadCertificateAttachment(
  ctx: AccessContext,
  certificateId: string,
  file: { name: string; type: string; size: number; bytes: Buffer },
): Promise<CertificateAttachmentRow> {
  assertAuthenticatedAccess(ctx, certificateId);
  assertModuleAccess(ctx, "certificates", "write");

  if (!ALLOWED_MIME.has(file.type)) {
    throw new AttachmentValidationError(
      "Only PDF, JPEG, and PNG attachments are allowed.",
    );
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentValidationError("Attachment must be between 1 byte and 10 MB.");
  }

  const db = getDb();
  let row: CertificateAttachmentRow;
  try {
    const cert = await db
      .select({ id: certificates.id, vesselId: certificates.vesselId })
      .from(certificates)
      .where(eq(certificates.id, certificateId))
      .limit(1);
    if (!cert[0]) {
      throw new CertificateNotFoundError(certificateId);
    }
    assertVesselScope(ctx, cert[0].vesselId);

    await mkdir(ATTACHMENTS_DIR, { recursive: true });
    const id = randomUUID();
    const storedName = `${id}${extensionForMime(file.type)}`;
    const absolute = path.join(ATTACHMENTS_DIR, storedName);
    const relativePath = path.join("data", "attachments", storedName).replace(/\\/g, "/");
    await writeFile(absolute, file.bytes);

    const inserted = await db
      .insert(certificateAttachments)
      .values({
        id,
        certificateId,
        fileName: file.name.slice(0, 255) || storedName,
        filePath: relativePath,
        uploadedBy: ctx.userId,
      })
      .returning();
    const insertedRow = inserted[0];
    if (!insertedRow) {
      await removeStoredAttachmentFile(relativePath);
      throw new Error("Attachment insert did not return a row");
    }
    row = insertedRow;
  } catch (error) {
    if (
      error instanceof CertificateNotFoundError ||
      error instanceof AttachmentValidationError
    ) {
      throw error;
    }
    logError("CERTIFICATE_ATTACHMENT_UPLOAD_FAILED", {
      error,
      certificateId,
    });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "uploaded",
    moduleName: "certificate",
    recordId: certificateId,
    description: `Uploaded attachment to certificate: ${row.fileName}`,
  });
  return row;
}

/** Deletes an attachment row and its on-disk file. */
export async function deleteCertificateAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, attachmentId);
  assertModuleAccess(ctx, "certificates", "write");
  const db = getDb();
  try {
    const rows = await db
      .select({
        attachment: certificateAttachments,
        vesselId: certificates.vesselId,
      })
      .from(certificateAttachments)
      .innerJoin(
        certificates,
        eq(certificateAttachments.certificateId, certificates.id),
      )
      .where(eq(certificateAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new AttachmentNotFoundError(attachmentId);
    }
    assertVesselScope(ctx, row.vesselId);
    await db
      .delete(certificateAttachments)
      .where(eq(certificateAttachments.id, attachmentId));
    await removeAttachmentFile(row.attachment.filePath);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) {
      throw error;
    }
    logError("CERTIFICATE_ATTACHMENT_DELETE_FAILED", {
      error,
      attachmentId,
    });
    throw error;
  }
}

/**
 * Looks up an attachment for the authenticated download route.
 * Path is taken only from the DB row — never from the request.
 */
export async function getCertificateAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<CertificateAttachmentRow | undefined> {
  assertAuthenticatedAccess(ctx, attachmentId);
  assertModuleAccess(ctx, "certificates", "read");
  const rows = await getDb()
    .select({
      attachment: certificateAttachments,
      vesselId: certificates.vesselId,
    })
    .from(certificateAttachments)
    .innerJoin(
      certificates,
      eq(certificateAttachments.certificateId, certificates.id),
    )
    .where(eq(certificateAttachments.id, attachmentId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  assertVesselScope(ctx, row.vesselId);
  return row.attachment;
}

/**
 * Opens a read stream for an attachment after validating the stored path
 * stays under `data/attachments/`. Prefer the generic `/api/attachments/[id]`
 * resolver for new call sites.
 */
export async function openAttachmentStream(
  ctx: AccessContext,
  attachmentId: string,
): Promise<{ row: CertificateAttachmentRow; stream: NodeJS.ReadableStream }> {
  const row = await getCertificateAttachmentById(ctx, attachmentId);
  if (!row) {
    throw new AttachmentNotFoundError(attachmentId);
  }
  try {
    const { stream } = openStoredAttachmentStream(row.filePath);
    return { row, stream };
  } catch {
    throw new AttachmentNotFoundError(attachmentId);
  }
}
