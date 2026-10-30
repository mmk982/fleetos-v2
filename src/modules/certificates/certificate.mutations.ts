import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { getDb, withDb } from "@/db/client";
import {
  certificateAttachments,
  certificates,
  certificateTypes,
  type CertificateRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  assertVesselScope,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import { removeStoredAttachmentFile } from "@/lib/attachments/stream";
import { logError } from "@/lib/logging";
import type {
  CertificateCreateInput,
  CertificateUpdateInput,
} from "./validation";
import {
  assertValidParentLink,
  CertificateConflictError,
  CertificateNotFoundError,
  CertificateTypeNotFoundError,
  countChildCertificates,
  isPgForeignKeyViolation,
  isPgUniqueViolation,
  loadType,
  refreshCachedStatus,
} from "./certificate.shared";
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
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx);
    assertModuleAccess(ctx, "certificates", "write");
    assertVesselScope(ctx, input.vesselId);
    const type = await loadType(ctx, input.certificateTypeId);
    const db = getDb();
    let result: CertificateRow;
  
    try {
      result = await db.transaction(async (tx) => {
        if (input.parentCertificateId) {
          await assertValidParentLink(
            tx,
            ctx,
            input.parentCertificateId,
            input.vesselId,
          );
        }
        const inserted = await tx
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
        return row;
      });
      await refreshCachedStatus(ctx, result, type);
      const refreshed = await db
        .select()
        .from(certificates)
        .where(eq(certificates.id, result.id))
        .limit(1);
      result = refreshed[0] ?? result;
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
  
  });
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
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx, id);
    assertModuleAccess(ctx, "certificates", "write");
    const db = getDb();
  
    let result: CertificateRow;
    let typeName: string | undefined;
    try {
      result = await db.transaction(async (tx) => {
        // Lock self + new parent in ascending id order up front so opposite
        // concurrent links (A→B and B→A) cannot deadlock on FOR UPDATE.
        if (typeof input.parentCertificateId === "string") {
          await tx
            .select({ id: certificates.id })
            .from(certificates)
            .where(inArray(certificates.id, [id, input.parentCertificateId]))
            .orderBy(asc(certificates.id))
            .for("update");
        }
  
        const existingRows = await tx
          .select()
          .from(certificates)
          .where(eq(certificates.id, id))
          .for("update")
          .limit(1);
        const existing = existingRows[0];
        if (!existing) {
          throw new CertificateNotFoundError(id);
        }
        assertVesselScope(ctx, existing.vesselId);
  
        const nextVesselId = input.vesselId ?? existing.vesselId;
        if (nextVesselId !== existing.vesselId) {
          assertVesselScope(ctx, nextVesselId);
  
          const keepsExistingParentLink =
            existing.parentCertificateId !== null &&
            input.parentCertificateId === undefined;
          if (keepsExistingParentLink) {
            throw new CertificateConflictError(
              "Certificate is linked to a parent on the current vessel — unlink it (set parentCertificateId to null) or move both certificates together.",
            );
          }
  
          const childCount = await countChildCertificates(id, tx);
          if (childCount > 0) {
            throw new CertificateConflictError(
              "Certificate has linked sub-items on the current vessel — unlink or move them first.",
            );
          }
        }
        if (input.parentCertificateId) {
          await assertValidParentLink(
            tx,
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
  
        const updated = await tx
          .update(certificates)
          .set(patch)
          .where(eq(certificates.id, id))
          .returning();
        const row = updated[0];
        if (!row) {
          throw new CertificateNotFoundError(id);
        }
        return row;
      });
  
      const type = await loadType(ctx, result.certificateTypeId);
      typeName = type.name;
      await refreshCachedStatus(ctx, result, type);
      const refreshed = await db
        .select()
        .from(certificates)
        .where(eq(certificates.id, id))
        .limit(1);
      result = refreshed[0] ?? result;
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
  
  });
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
  return withDb(ctx, async () => {
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
    const subItemCount = await countChildCertificates(id, db);
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
    const detachedNote =
      subItemCount > 0
        ? ` (${subItemCount} sub-item${subItemCount === 1 ? "" : "s"} detached)`
        : "";
    await writeActivityLog({
      userId: ctx.userId,
      actionType: "deleted",
      moduleName: "certificate",
      recordId: id,
      description: `Deleted certificate: ${label}${detachedNote}`,
    });
  
  });
}
