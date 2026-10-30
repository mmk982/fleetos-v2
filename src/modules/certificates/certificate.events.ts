import "server-only";

import { eq } from "drizzle-orm";
import { getDb, withDb } from "@/db/client";
import {
  certificates,
  certificateEvents,
  type CertificateEventRow,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  assertVesselScope,
  type AccessContext,
} from "@/lib/auth/access";
import { logError } from "@/lib/logging";
import type { CertificateEventCreateInput } from "./validation";
import {
  CertificateNotFoundError,
  loadType,
  refreshCachedStatus,
} from "./certificate.shared";
/**
 * Adds a history event. `extended`/`renewed` push `expiryDate`;
 * `revoked` sets `lifecycleStatus`. Then recomputes `cachedStatus`.
 */
export async function addCertificateEvent(
  ctx: AccessContext,
  input: CertificateEventCreateInput,
): Promise<CertificateEventRow> {
  return withDb(ctx, async () => {
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
  
  });
}
