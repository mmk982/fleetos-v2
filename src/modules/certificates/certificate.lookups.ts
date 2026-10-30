import "server-only";

import { asc, eq } from "drizzle-orm";
import { getDb, withDb } from "@/db/client";
import {
  certificateTypes,
  issuingAuthorities,
  type CertificateAuthority,
  type CertificateTypeRow,
  type IssuingAuthorityRow,
  type ReminderRuleKind,
} from "@/db/schema";
import {
  assertAuthenticatedAccess,
  assertModuleAccess,
  type AccessContext,
} from "@/lib/auth/access";
import { logError } from "@/lib/logging";
import {
  CertificateConflictError,
  CertificateTypeNotFoundError,
  IssuingAuthorityNotFoundError,
  isPgForeignKeyViolation,
  isPgUniqueViolation,
} from "./certificate.shared";
/** Certificate types for form dropdowns, grouped by authority at the UI layer. */
export async function listCertificateTypes(
  ctx: AccessContext,
): Promise<CertificateTypeRow[]> {
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx);
    assertModuleAccess(ctx, "certificates", "read");
    return getDb()
      .select()
      .from(certificateTypes)
      .orderBy(asc(certificateTypes.authority), asc(certificateTypes.name));
  
  });
}

/** Issuing authorities for form dropdowns / filters. */
export async function listIssuingAuthorities(
  ctx: AccessContext,
): Promise<IssuingAuthorityRow[]> {
  return withDb(ctx, async () => {
    assertAuthenticatedAccess(ctx);
    assertModuleAccess(ctx, "certificates", "read");
    return getDb()
      .select()
      .from(issuingAuthorities)
      .orderBy(asc(issuingAuthorities.name));
  
  });
}

export async function createIssuingAuthority(
  ctx: AccessContext,
  input: { name: string },
): Promise<IssuingAuthorityRow> {
  return withDb(ctx, async () => {
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
  
  });
}

export async function updateIssuingAuthority(
  ctx: AccessContext,
  id: string,
  input: { name: string },
): Promise<IssuingAuthorityRow> {
  return withDb(ctx, async () => {
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
  
  });
}

export async function deleteIssuingAuthority(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  return withDb(ctx, async () => {
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
  
  });
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
  return withDb(ctx, async () => {
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
  
  });
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
  return withDb(ctx, async () => {
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
  
  });
}

export async function deleteCertificateType(
  ctx: AccessContext,
  id: string,
): Promise<void> {
  return withDb(ctx, async () => {
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
  
  });
}
