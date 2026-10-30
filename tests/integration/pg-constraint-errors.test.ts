/**
 * Real-Postgres constraint mapping: Drizzle wraps driver errors, so helpers
 * that only read outer `.code` miss 23505/23503 and leak 500s.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { closeDb, getDb, withDb } from "@/db/client";
import { certificates, issuingAuthorities } from "@/db/schema";
import type { AccessContext } from "@/lib/auth/access";
import {
  CertificateConflictError,
  createCertificate,
  createIssuingAuthority,
  deleteCertificateType,
  deleteIssuingAuthority,
} from "@/modules/certificates/certificate.controller";
import { certificateCreateSchema } from "@/modules/certificates/validation";
import {
  createCrewCategory,
  CrewConflictError,
} from "@/modules/crew/crew.controller";
import {
  createMonthlyFormRequirement,
  MonthlyFormRequirementConflictError,
} from "@/modules/monthly-forms/monthly-form-requirement.controller";
import {
  createVessel,
  deleteVessel,
  VesselConflictError,
} from "@/modules/vessels/vessel.controller";
import {
  canReachPostgres,
  createRlsTestDatabase,
  dropRlsTestDatabase,
  type RlsFixtures,
} from "./harness";

let fixtures: RlsFixtures;
let dbAvailable = false;

function adminCtx(): AccessContext {
  return {
    userId: fixtures.users.admin,
    role: "admin",
    vesselId: null,
  };
}

beforeAll(async () => {
  dbAvailable = await canReachPostgres();
  if (!dbAvailable) {
    console.warn(
      "Skipping pg-constraint integration tests: Postgres unreachable.",
    );
    return;
  }
  const created = await createRlsTestDatabase();
  fixtures = created.fixtures;
  process.env.DATABASE_URL = created.appUrl;
  await closeDb();
});

afterAll(async () => {
  await closeDb();
  if (dbAvailable) {
    await dropRlsTestDatabase();
  }
});

describe("Postgres constraint errors via real controllers", () => {
  it("skips cleanly when DB is down", ({ skip }) => {
    if (!dbAvailable) {
      skip("Postgres unreachable");
    }
    expect(dbAvailable).toBe(true);
  });

  it("maps duplicate vessel IMO to VesselConflictError (not DrizzleQueryError)", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = adminCtx();
    await expect(
      createVessel(access, {
        name: "Dup IMO Vessel",
        imoNumber: 9111111,
        status: "active",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(VesselConflictError);
      expect(error).not.toBeInstanceOf(DrizzleQueryError);
      return true;
    });
  });

  it("maps duplicate issuing-authority name to CertificateConflictError", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = adminCtx();
    const first = await createIssuingAuthority(access, {
      name: "PG-ERR Auth Unique",
    });
    expect(first.id).toBeTruthy();
    await expect(
      createIssuingAuthority(access, { name: "PG-ERR Auth Unique" }),
    ).rejects.toBeInstanceOf(CertificateConflictError);
  });

  it("maps duplicate crew category name to CrewConflictError", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = adminCtx();
    await createCrewCategory(access, { name: "PG-ERR Crew Cat" });
    await expect(
      createCrewCategory(access, { name: "PG-ERR Crew Cat" }),
    ).rejects.toBeInstanceOf(CrewConflictError);
  });

  it("maps duplicate monthly form requirement to conflict error", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = adminCtx();
    await expect(
      createMonthlyFormRequirement(access, {
        vesselId: fixtures.vesselA,
        ismTemplateId: fixtures.ismTemplateId,
        frequency: "monthly",
        activeStatus: true,
      }),
    ).rejects.toBeInstanceOf(MonthlyFormRequirementConflictError);
  });

  it("maps delete of in-use issuing authority to CertificateConflictError", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = adminCtx();
    const auth = await createIssuingAuthority(access, {
      name: "PG-ERR Auth In Use",
    });
    await withDb(access, async () => {
      await getDb()
        .update(certificates)
        .set({ issuingAuthorityId: auth.id })
        .where(eq(certificates.id, fixtures.certA));
    });
    await expect(deleteIssuingAuthority(access, auth.id)).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(CertificateConflictError);
        expect((error as Error).message).toMatch(/still referenced/i);
        expect(error).not.toBeInstanceOf(DrizzleQueryError);
        return true;
      },
    );
    const stillThere = await withDb(access, async () =>
      getDb()
        .select({ id: issuingAuthorities.id })
        .from(issuingAuthorities)
        .where(eq(issuingAuthorities.id, auth.id)),
    );
    expect(stillThere).toHaveLength(1);
  });

  it("maps delete of in-use certificate type to CertificateConflictError", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = adminCtx();
    await expect(
      deleteCertificateType(access, fixtures.certificateTypeId),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(CertificateConflictError);
      expect((error as Error).message).toMatch(/still referenced/i);
      return true;
    });
  });

  it("maps createCertificate with unknown vesselId to CertificateConflictError", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = adminCtx();
    await expect(
      createCertificate(access, {
        vesselId: "00000000-0000-4000-8000-000000000099",
        certificateTypeId: fixtures.certificateTypeId,
        linkedToDryDock: false,
        lifecycleStatus: "active",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(CertificateConflictError);
      expect((error as Error).message).toMatch(/invalid/i);
      expect(error).not.toBeInstanceOf(DrizzleQueryError);
      return true;
    });
  });

  it("rejects malformed vesselId at the zod boundary (400 path, not 22P02)", () => {
    const parsed = certificateCreateSchema.safeParse({
      vesselId: "not-a-uuid",
      certificateTypeId: "00000000-0000-4000-8000-000000000001",
      linkedToDryDock: false,
      lifecycleStatus: "active",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.vesselId?.length).toBeGreaterThan(
        0,
      );
    }
  });

  it("maps deleteVessel with dependents to VesselConflictError", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = adminCtx();
    await expect(deleteVessel(access, fixtures.vesselA)).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(VesselConflictError);
        expect((error as Error).message).toMatch(/still referenced|cannot delete/i);
        expect(error).not.toBeInstanceOf(DrizzleQueryError);
        return true;
      },
    );
  });
});
