/**
 * Insurance data-access layer (`PROJECT_PLAN.md` §4).
 *
 * Only file in this module allowed to import drizzle-orm query builders.
 * Live status always comes from `deriveComplianceStatus` with the fixed
 * 30d offset rule — `cachedStatus` is a non-authoritative write-side cache.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  insuranceAttachments,
  insurancePolicies,
  vessels,
  type InsuranceAttachmentRow,
  type InsurancePolicyRow,
  type InsuranceType,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { removeStoredAttachmentFile } from "@/lib/attachments/stream";
import {
  deriveComplianceStatus,
  type ComplianceResult,
  type ComplianceStatus,
} from "@/lib/expiry";
import { logError } from "@/lib/logging";
import {
  INSURANCE_REMINDER_RULE,
  type InsuranceListItem,
} from "./insurance.model";
import type {
  InsuranceCreateInput,
  InsuranceUpdateInput,
} from "./validation";

export type { InsuranceListItem } from "./insurance.model";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export class InsuranceNotFoundError extends Error {
  readonly code = "INSURANCE_NOT_FOUND" as const;
  constructor(id: string) {
    super(`Insurance policy not found: ${id}`);
    this.name = "InsuranceNotFoundError";
  }
}

export class InsuranceConflictError extends Error {
  readonly code = "INSURANCE_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "InsuranceConflictError";
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

function isPgForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

function deriveForPolicy(policy: {
  expiryDate: string | null;
}): ComplianceResult {
  return deriveComplianceStatus({
    rule: INSURANCE_REMINDER_RULE,
    expiryDate: policy.expiryDate,
  });
}

async function refreshCachedStatus(
  policy: InsurancePolicyRow,
): Promise<ComplianceStatus> {
  const compliance = deriveForPolicy(policy);
  await getDb()
    .update(insurancePolicies)
    .set({ cachedStatus: compliance.status, updatedAt: new Date() })
    .where(eq(insurancePolicies.id, policy.id));
  return compliance.status;
}

function toListItem(
  policy: InsurancePolicyRow,
  vesselName: string,
): InsuranceListItem {
  return {
    ...policy,
    vesselName,
    compliance: deriveForPolicy(policy),
  };
}

export type InsuranceListFilters = {
  vesselId?: string;
  policyType?: InsuranceType;
};

export async function listInsurancePolicies(
  ctx: AccessContext,
  filters: InsuranceListFilters = {},
): Promise<InsuranceListItem[]> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  const conditions: SQL[] = [];
  if (filters.vesselId) {
    conditions.push(eq(insurancePolicies.vesselId, filters.vesselId));
  }
  if (filters.policyType) {
    conditions.push(eq(insurancePolicies.policyType, filters.policyType));
  }

  const rows = await db
    .select({
      policy: insurancePolicies,
      vesselName: vessels.name,
    })
    .from(insurancePolicies)
    .innerJoin(vessels, eq(insurancePolicies.vesselId, vessels.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(vessels.name), asc(insurancePolicies.policyType));

  return rows.map((r) => toListItem(r.policy, r.vesselName));
}

export type InsuranceDetail = InsuranceListItem & {
  attachments: InsuranceAttachmentRow[];
};

export async function getInsurancePolicyById(
  ctx: AccessContext,
  id: string,
): Promise<InsuranceDetail | undefined> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  const rows = await db
    .select({
      policy: insurancePolicies,
      vesselName: vessels.name,
    })
    .from(insurancePolicies)
    .innerJoin(vessels, eq(insurancePolicies.vesselId, vessels.id))
    .where(eq(insurancePolicies.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;

  const attachments = await db
    .select()
    .from(insuranceAttachments)
    .where(eq(insuranceAttachments.insurancePolicyId, id))
    .orderBy(asc(insuranceAttachments.uploadedAt));

  return {
    ...toListItem(row.policy, row.vesselName),
    attachments,
  };
}

export async function createInsurancePolicy(
  ctx: AccessContext,
  input: InsuranceCreateInput,
): Promise<InsurancePolicyRow> {
  assertAuthenticatedAccess(ctx);
  const db = getDb();
  try {
    const inserted = await db
      .insert(insurancePolicies)
      .values({
        vesselId: input.vesselId,
        policyType: input.policyType,
        provider: input.provider ?? null,
        policyNumber: input.policyNumber ?? null,
        coverageAmount: input.coverageAmount ?? null,
        currency: input.currency ?? null,
        startDate: input.startDate ?? null,
        expiryDate: input.expiryDate ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("Insurance policy insert did not return a row");
    await refreshCachedStatus(row);
    const refreshed = await db
      .select()
      .from(insurancePolicies)
      .where(eq(insurancePolicies.id, row.id))
      .limit(1);
    return refreshed[0] ?? row;
  } catch (error) {
    if (isPgForeignKeyViolation(error)) {
      throw new InsuranceConflictError("Vessel reference is invalid.");
    }
    logError("INSURANCE_CREATE_FAILED", { error });
    throw error;
  }
}

export async function updateInsurancePolicy(
  ctx: AccessContext,
  id: string,
  input: InsuranceUpdateInput,
): Promise<InsurancePolicyRow> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();

  const existing = await db
    .select()
    .from(insurancePolicies)
    .where(eq(insurancePolicies.id, id))
    .limit(1);
  if (!existing[0]) throw new InsuranceNotFoundError(id);

  const patch: Partial<typeof insurancePolicies.$inferInsert> & {
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (input.vesselId !== undefined) patch.vesselId = input.vesselId;
  if (input.policyType !== undefined) patch.policyType = input.policyType;
  if (input.provider !== undefined) patch.provider = input.provider;
  if (input.policyNumber !== undefined) patch.policyNumber = input.policyNumber;
  if (input.coverageAmount !== undefined) {
    patch.coverageAmount = input.coverageAmount;
  }
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.startDate !== undefined) patch.startDate = input.startDate;
  if (input.expiryDate !== undefined) patch.expiryDate = input.expiryDate;
  if (input.notes !== undefined) patch.notes = input.notes;

  try {
    const updated = await db
      .update(insurancePolicies)
      .set(patch)
      .where(eq(insurancePolicies.id, id))
      .returning();
    const row = updated[0];
    if (!row) throw new InsuranceNotFoundError(id);
    await refreshCachedStatus(row);
    const refreshed = await db
      .select()
      .from(insurancePolicies)
      .where(eq(insurancePolicies.id, id))
      .limit(1);
    return refreshed[0] ?? row;
  } catch (error) {
    if (error instanceof InsuranceNotFoundError) throw error;
    if (isPgForeignKeyViolation(error)) {
      throw new InsuranceConflictError("Vessel reference is invalid.");
    }
    logError("INSURANCE_UPDATE_FAILED", { error, insurancePolicyId: id });
    throw error;
  }
}

/** Hard-delete; removes on-disk attachment files first (same order as crew certs). */
export async function deleteInsurancePolicy(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, id);
  const db = getDb();
  try {
    const atts = await db
      .select()
      .from(insuranceAttachments)
      .where(eq(insuranceAttachments.insurancePolicyId, id));
    for (const att of atts) {
      await removeStoredAttachmentFile(att.filePath);
    }
    const deleted = await db
      .delete(insurancePolicies)
      .where(eq(insurancePolicies.id, id))
      .returning({ id: insurancePolicies.id });
    if (deleted.length === 0) throw new InsuranceNotFoundError(id);
  } catch (error) {
    if (error instanceof InsuranceNotFoundError) throw error;
    logError("INSURANCE_DELETE_FAILED", { error, insurancePolicyId: id });
    throw error;
  }
}

export async function listInsuranceAttachments(
  ctx: AccessContext,
  insurancePolicyId: string,
): Promise<InsuranceAttachmentRow[]> {
  assertAuthenticatedAccess(ctx, insurancePolicyId);
  return getDb()
    .select()
    .from(insuranceAttachments)
    .where(eq(insuranceAttachments.insurancePolicyId, insurancePolicyId))
    .orderBy(asc(insuranceAttachments.uploadedAt));
}

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

export async function uploadInsuranceAttachment(
  ctx: AccessContext,
  insurancePolicyId: string,
  file: { name: string; type: string; size: number; bytes: Buffer },
): Promise<InsuranceAttachmentRow> {
  assertAuthenticatedAccess(ctx, insurancePolicyId);

  if (!ALLOWED_MIME.has(file.type)) {
    throw new AttachmentValidationError(
      "Only PDF, JPEG, and PNG attachments are allowed.",
    );
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentValidationError(
      "Attachment must be between 1 byte and 10 MB.",
    );
  }

  const db = getDb();
  try {
    const parent = await db
      .select({ id: insurancePolicies.id })
      .from(insurancePolicies)
      .where(eq(insurancePolicies.id, insurancePolicyId))
      .limit(1);
    if (!parent[0]) throw new InsuranceNotFoundError(insurancePolicyId);

    await mkdir(ATTACHMENTS_DIR, { recursive: true });
    const id = randomUUID();
    const storedName = `${id}${extensionForMime(file.type)}`;
    const absolute = path.join(ATTACHMENTS_DIR, storedName);
    const relativePath = path
      .join("data", "attachments", storedName)
      .replace(/\\/g, "/");
    await writeFile(absolute, file.bytes);

    const inserted = await db
      .insert(insuranceAttachments)
      .values({
        id,
        insurancePolicyId,
        fileName: file.name.slice(0, 255) || storedName,
        filePath: relativePath,
        uploadedBy: ctx.userId,
      })
      .returning();
    const row = inserted[0];
    if (!row) {
      await removeStoredAttachmentFile(relativePath);
      throw new Error("Attachment insert did not return a row");
    }
    return row;
  } catch (error) {
    if (
      error instanceof InsuranceNotFoundError ||
      error instanceof AttachmentValidationError
    ) {
      throw error;
    }
    logError("INSURANCE_ATTACHMENT_UPLOAD_FAILED", {
      error,
      insurancePolicyId,
    });
    throw error;
  }
}

export async function deleteInsuranceAttachment(
  ctx: AccessContext,
  attachmentId: string,
): Promise<void> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(insuranceAttachments)
      .where(eq(insuranceAttachments.id, attachmentId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AttachmentNotFoundError(attachmentId);
    await db
      .delete(insuranceAttachments)
      .where(eq(insuranceAttachments.id, attachmentId));
    await removeStoredAttachmentFile(row.filePath);
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) throw error;
    logError("INSURANCE_ATTACHMENT_DELETE_FAILED", {
      error,
      attachmentId,
    });
    throw error;
  }
}

/**
 * Lookup for the generic `/api/attachments/[id]` resolver.
 * Does not write access_logs — insurance is out of GDPR access-log scope
 * (SECURITY_PLAN.md §6b is Crew-only).
 */
export async function getInsuranceAttachmentById(
  ctx: AccessContext,
  attachmentId: string,
): Promise<InsuranceAttachmentRow | undefined> {
  assertAuthenticatedAccess(ctx, attachmentId);
  const rows = await getDb()
    .select()
    .from(insuranceAttachments)
    .where(eq(insuranceAttachments.id, attachmentId))
    .limit(1);
  return rows[0];
}
