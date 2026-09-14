/**
 * GDPR scrub-PII for a crew member (`MASTER_PLAN.md` Phase 4).
 *
 * Nulls personal fields on `crew_members` and `crew_certificates`, and
 * removes `crew_certificate_attachments` rows **and** on-disk files via
 * {@link removeStoredAttachmentFile}. The parent row is kept (RESTRICT
 * FK / operational history) — erasure without deleting the identity row.
 *
 * DB writes (attachment row delete, certificate PII update, member PII
 * update) run in one transaction so a mid-scrub failure rolls back rather
 * than leaving a half-erased member. On-disk deletes run only after that
 * commit succeeds.
 *
 * NOT NULL name columns become the sentinel `"[erased]"` because Postgres
 * cannot store null there; all other PII columns are set to null.
 */
import "server-only";

import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  crewCertificateAttachments,
  crewCertificates,
  crewMembers,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { writeActivityLog } from "@/lib/activity-log/write";
import { removeStoredAttachmentFile } from "@/lib/attachments/stream";
import { logError } from "@/lib/logging";

const ERASED_NAME = "[erased]";

export class CrewMemberNotFoundError extends Error {
  readonly code = "CREW_MEMBER_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Crew member not found: ${id}`);
    this.name = "CrewMemberNotFoundError";
  }
}

/**
 * Scrubs personal data for one crew member without deleting the row.
 *
 * @returns the number of attachment files removed from disk/DB.
 */
export async function scrubCrewMemberPii(
  ctx: AccessContext,
  id: string,
): Promise<{ attachmentsRemoved: number }> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  let name: string | undefined;
  let attachmentsRemoved = 0;
  try {
    const members = await db
      .select({
        id: crewMembers.id,
        firstName: crewMembers.firstName,
        lastName: crewMembers.lastName,
      })
      .from(crewMembers)
      .where(eq(crewMembers.id, id))
      .limit(1);
    if (!members[0]) throw new CrewMemberNotFoundError(id);
    name = `${members[0].firstName} ${members[0].lastName}`;

    const certs = await db
      .select({ id: crewCertificates.id })
      .from(crewCertificates)
      .where(eq(crewCertificates.crewMemberId, id));
    const certIds = certs.map((c) => c.id);

    const atts =
      certIds.length > 0
        ? await db
            .select()
            .from(crewCertificateAttachments)
            .where(
              inArray(crewCertificateAttachments.crewCertificateId, certIds),
            )
        : [];
    const filePaths = atts.map((a) => a.filePath);

    await db.transaction(async (tx) => {
      if (atts.length > 0) {
        await tx
          .delete(crewCertificateAttachments)
          .where(
            inArray(
              crewCertificateAttachments.id,
              atts.map((a) => a.id),
            ),
          );
      }

      if (certIds.length > 0) {
        await tx
          .update(crewCertificates)
          .set({
            documentNumber: null,
            issuingAuthority: null,
            issueDate: null,
            expiryDate: null,
            cachedStatus: null,
            notes: null,
            updatedAt: new Date(),
          })
          .where(eq(crewCertificates.crewMemberId, id));
      }

      await tx
        .update(crewMembers)
        .set({
          firstName: ERASED_NAME,
          lastName: ERASED_NAME,
          nationality: null,
          dateOfBirth: null,
          notes: null,
          updatedAt: new Date(),
        })
        .where(eq(crewMembers.id, id));
    });

    for (const filePath of filePaths) {
      try {
        await removeStoredAttachmentFile(filePath);
        attachmentsRemoved += 1;
      } catch (error) {
        logError("CREW_SCRUB_PII_FILE_DELETE_FAILED", {
          error,
          filePath,
          crewMemberId: id,
        });
      }
    }
  } catch (error) {
    if (error instanceof CrewMemberNotFoundError) throw error;
    logError("CREW_SCRUB_PII_FAILED", { error, crewMemberId: id });
    throw error;
  }
  await writeActivityLog({
    userId: ctx.userId,
    actionType: "deleted",
    moduleName: "crew",
    recordId: id,
    description: name
      ? `Deleted crew member: ${name}`
      : "Deleted crew member",
  });
  return { attachmentsRemoved };
}
