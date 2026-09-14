/**
 * Company Profile data-access (`PROJECT_PLAN.md` §7a).
 * Single-row table (id=1); logo stored like module attachments.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companyProfile, type CompanyProfileRow } from "@/db/schema";
import {
  assertAuthenticatedAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { removeStoredAttachmentFile } from "@/lib/attachments/stream";
import { logError } from "@/lib/logging";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_LOGO_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);

export class CompanyProfileConflictError extends Error {
  readonly code = "COMPANY_PROFILE_CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "CompanyProfileConflictError";
  }
}

export class LogoValidationError extends Error {
  readonly code = "LOGO_VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "LogoValidationError";
  }
}

export type CompanyProfileUpdateInput = {
  companyName?: string | null;
  registrationNumber?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  timezone?: string | null;
  dateFormat?: string | null;
};

type UploadFile = { name: string; type: string; size: number; bytes: Buffer };

function extensionForMime(mime: string): string {
  if (mime === "image/png") return ".png";
  return ".jpg";
}

/**
 * Ensures the singleton row exists and returns it.
 * Safe to call from login (no auth) for display.
 */
export async function getCompanyProfile(): Promise<CompanyProfileRow> {
  const db = getDb();
  const existing = await db
    .select()
    .from(companyProfile)
    .where(eq(companyProfile.id, 1))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(companyProfile)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];

  const again = await db
    .select()
    .from(companyProfile)
    .where(eq(companyProfile.id, 1))
    .limit(1);
  if (!again[0]) throw new Error("Failed to load company profile");
  return again[0];
}

export async function updateCompanyProfile(
  ctx: AccessContext,
  input: CompanyProfileUpdateInput,
): Promise<CompanyProfileRow> {
  assertAuthenticatedAccess(ctx);
  await getCompanyProfile();
  const patch: Partial<typeof companyProfile.$inferInsert> & {
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (input.companyName !== undefined) patch.companyName = input.companyName;
  if (input.registrationNumber !== undefined) {
    patch.registrationNumber = input.registrationNumber;
  }
  if (input.address !== undefined) patch.address = input.address;
  if (input.contactEmail !== undefined) patch.contactEmail = input.contactEmail;
  if (input.contactPhone !== undefined) patch.contactPhone = input.contactPhone;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.dateFormat !== undefined) patch.dateFormat = input.dateFormat;

  try {
    const updated = await getDb()
      .update(companyProfile)
      .set(patch)
      .where(eq(companyProfile.id, 1))
      .returning();
    const row = updated[0];
    if (!row) throw new Error("Company profile update returned no row");
    return row;
  } catch (error) {
    logError("COMPANY_PROFILE_UPDATE_FAILED", { error });
    throw error;
  }
}

export async function uploadCompanyLogo(
  ctx: AccessContext,
  file: UploadFile,
): Promise<CompanyProfileRow> {
  assertAuthenticatedAccess(ctx);
  if (!ALLOWED_MIME.has(file.type)) {
    throw new LogoValidationError("Logo must be JPEG or PNG.");
  }
  if (file.size <= 0 || file.size > MAX_LOGO_BYTES) {
    throw new LogoValidationError("Logo must be between 1 byte and 10 MB.");
  }

  const current = await getCompanyProfile();
  await mkdir(ATTACHMENTS_DIR, { recursive: true });
  const storedName = `company-logo-${randomUUID()}${extensionForMime(file.type)}`;
  const absolute = path.join(ATTACHMENTS_DIR, storedName);
  const relativePath = path
    .join("data", "attachments", storedName)
    .replace(/\\/g, "/");
  await writeFile(absolute, file.bytes);

  try {
    const updated = await getDb()
      .update(companyProfile)
      .set({ logoPath: relativePath, updatedAt: new Date() })
      .where(eq(companyProfile.id, 1))
      .returning();
    const row = updated[0];
    if (!row) throw new Error("Logo update returned no row");
    if (current.logoPath) {
      await removeStoredAttachmentFile(current.logoPath);
    }
    return row;
  } catch (error) {
    await removeStoredAttachmentFile(relativePath);
    logError("COMPANY_LOGO_UPLOAD_FAILED", { error });
    throw error;
  }
}

export async function clearCompanyLogo(ctx: AccessContext): Promise<CompanyProfileRow> {
  assertAuthenticatedAccess(ctx);
  const current = await getCompanyProfile();
  const updated = await getDb()
    .update(companyProfile)
    .set({ logoPath: null, updatedAt: new Date() })
    .where(eq(companyProfile.id, 1))
    .returning();
  const row = updated[0];
  if (!row) throw new Error("Logo clear returned no row");
  if (current.logoPath) {
    await removeStoredAttachmentFile(current.logoPath);
  }
  return row;
}
