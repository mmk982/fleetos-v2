/**
 * Phase-1 RLS integration tests (real Postgres).
 * Assert fail-closed vessel isolation for `fleetos_app` + nested withDb safety.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  closeDb,
  getDb,
  withDb,
  withSavepoint,
  withSystemDb,
} from "@/db/client";
import { writeAccessLog } from "@/lib/access-log/write";
import {
  accessLogs,
  certificates,
  crewCertificateAttachments,
  crewCertificates,
  crewMembers,
} from "@/db/schema";
import type { AccessContext } from "@/lib/auth/access";
import {
  canReachPostgres,
  createRlsTestDatabase,
  dropRlsTestDatabase,
  type RlsFixtures,
} from "./harness";

let fixtures: RlsFixtures;
let dbAvailable = false;

function ctx(
  partial: Pick<AccessContext, "userId" | "role" | "vesselId">,
): AccessContext {
  return {
    userId: partial.userId,
    role: partial.role,
    vesselId: partial.vesselId,
  };
}

beforeAll(async () => {
  dbAvailable = await canReachPostgres();
  if (!dbAvailable) {
    console.warn(
      "Skipping RLS integration tests: Postgres unreachable at DATABASE_MIGRATE_URL / local owner default.",
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

describe("RLS phase 1", () => {
  it("skips cleanly when DB is down", ({ skip }) => {
    if (!dbAvailable) {
      skip(
        "Postgres unreachable — start docker compose and re-run npm run test:integration",
      );
    }
    expect(dbAvailable).toBe(true);
  });

  it("scoped vessel_user on A sees only A rows in every phase-1 table", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = ctx({
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    });

    await withDb(access, async () => {
      const certIds = (await getDb().select({ id: certificates.id }).from(certificates)).map(
        (r) => r.id,
      );
      expect(certIds).toEqual([fixtures.certA]);

      const crewIds = (await getDb().select({ id: crewMembers.id }).from(crewMembers)).map(
        (r) => r.id,
      );
      expect(crewIds).toEqual([fixtures.crewA]);

      const crewCertIds = (
        await getDb().select({ id: crewCertificates.id }).from(crewCertificates)
      ).map((r) => r.id);
      expect(crewCertIds).toEqual([fixtures.crewCertA]);

      const attachIds = (
        await getDb()
          .select({ id: crewCertificateAttachments.id })
          .from(crewCertificateAttachments)
      ).map((r) => r.id);
      expect(attachIds).toEqual([fixtures.crewAttachA]);

      const logIds = (await getDb().select({ id: accessLogs.id }).from(accessLogs)).map(
        (r) => r.id,
      );
      expect(logIds).toContain(fixtures.accessLogA);
      expect(logIds).not.toContain(fixtures.accessLogB);
    });
  });

  it("scoped user on A cannot INSERT a certificate for vessel B", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = ctx({
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    });

    await withDb(access, async () => {
      let threw = false;
      try {
        await getDb().insert(certificates).values({
          vesselId: fixtures.vesselB,
          certificateTypeId: fixtures.certificateTypeId,
          lifecycleStatus: "active",
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  it("maps RLS INSERT denial (42501) through withDb to ForbiddenError", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const { ForbiddenError } = await import("@/lib/auth/access");
    const access = ctx({
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    });

    // Module checks would normally stop a cross-vessel write; call the
    // wrapper directly so only RLS WITH CHECK can deny.
    await expect(
      withDb(access, async () => {
        await getDb().insert(certificates).values({
          vesselId: fixtures.vesselB,
          certificateTypeId: fixtures.certificateTypeId,
          lifecycleStatus: "active",
        });
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("scoped user on A cannot UPDATE a B certificate (0 rows)", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = ctx({
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    });

    await withDb(access, async () => {
      const updated = await getDb()
        .update(certificates)
        .set({ remarks: "leaked" })
        .where(eq(certificates.id, fixtures.certB))
        .returning({ id: certificates.id });
      expect(updated).toEqual([]);
    });
  });

  it("scoped user on A cannot DELETE a B certificate (0 rows)", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = ctx({
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    });

    await withDb(access, async () => {
      const deleted = await getDb()
        .delete(certificates)
        .where(eq(certificates.id, fixtures.certB))
        .returning({ id: certificates.id });
      expect(deleted).toEqual([]);
    });
  });

  it("office roles see both vessels; read_only cannot write", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();

    await withDb(
      ctx({
        userId: fixtures.users.admin,
        role: "admin",
        vesselId: null,
      }),
      async () => {
        const rows = await getDb().select({ id: certificates.id }).from(certificates);
        expect(rows.map((r) => r.id).sort()).toEqual(
          [fixtures.certA, fixtures.certB].sort(),
        );
      },
    );

    await withDb(
      ctx({
        userId: fixtures.users.readOnly,
        role: "read_only",
        vesselId: null,
      }),
      async () => {
        const rows = await getDb().select({ id: certificates.id }).from(certificates);
        expect(rows).toHaveLength(2);

        let threw = false;
        try {
          await getDb().insert(certificates).values({
            vesselId: fixtures.vesselA,
            certificateTypeId: fixtures.certificateTypeId,
            lifecycleStatus: "active",
          });
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);
      },
    );
  });

  it("fail-closed: query with no context returns 0 rows and cannot write", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    // Bare pooled client — no set_config
    const rows = await getDb().select({ id: certificates.id }).from(certificates);
    expect(rows).toEqual([]);

    let threw = false;
    try {
      await getDb().insert(certificates).values({
        vesselId: fixtures.vesselA,
        certificateTypeId: fixtures.certificateTypeId,
        lifecycleStatus: "active",
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("scoped user with no vessel returns 0 rows", async ({ skip }) => {
    if (!dbAvailable) skip();
    await withDb(
      ctx({
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: null,
      }),
      async () => {
        const rows = await getDb().select({ id: certificates.id }).from(certificates);
        expect(rows).toEqual([]);
      },
    );
  });

  it("bypass check: forgetting assertVesselScope still cannot leak B rows", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    // Simulates a buggy controller that skips assertVesselScope and selects by id.
    const access = ctx({
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    });

    await withDb(access, async () => {
      const leaked = await getDb()
        .select({ id: certificates.id })
        .from(certificates)
        .where(eq(certificates.id, fixtures.certB));
      expect(leaked).toEqual([]);

      const crewLeak = await getDb()
        .select({ id: crewMembers.id })
        .from(crewMembers)
        .where(eq(crewMembers.id, fixtures.crewB));
      expect(crewLeak).toEqual([]);
    });
  });

  it("context never leaks across pooled connections", async ({ skip }) => {
    if (!dbAvailable) skip();

    await withDb(
      ctx({
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: fixtures.vesselA,
      }),
      async () => {
        const rows = await getDb().select({ id: certificates.id }).from(certificates);
        expect(rows).toHaveLength(1);
      },
    );

    // Request 2: same pool, no context
    const rows = await getDb().select({ id: certificates.id }).from(certificates);
    expect(rows).toEqual([]);
  });

  it("system role can SELECT phase-1 rows for digest/cron", async ({ skip }) => {
    if (!dbAvailable) skip();
    await withSystemDb("integration-test", async () => {
      const rows = await getDb().select({ id: certificates.id }).from(certificates);
      expect(rows).toHaveLength(2);
    });
  });

  it("management_user on A is read-only for certificates (no insert)", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    await withDb(
      ctx({
        userId: fixtures.users.managementA,
        role: "management_user",
        vesselId: fixtures.vesselA,
      }),
      async () => {
        const rows = await getDb().select({ id: certificates.id }).from(certificates);
        expect(rows.map((r) => r.id)).toEqual([fixtures.certA]);

        let threw = false;
        try {
          await getDb().insert(certificates).values({
            vesselId: fixtures.vesselA,
            certificateTypeId: fixtures.certificateTypeId,
            lifecycleStatus: "active",
          });
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);
      },
    );
  });

  it("superintendent can write certificates for any vessel", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const newId = crypto.randomUUID();
    await withDb(
      ctx({
        userId: fixtures.users.superintendent,
        role: "superintendent",
        vesselId: null,
      }),
      async () => {
        await getDb().insert(certificates).values({
          id: newId,
          vesselId: fixtures.vesselB,
          certificateTypeId: fixtures.certificateTypeId,
          lifecycleStatus: "active",
        });
        const rows = await getDb()
          .select({ id: certificates.id })
          .from(certificates)
          .where(eq(certificates.id, newId));
        expect(rows).toHaveLength(1);

        await getDb()
          .delete(certificates)
          .where(and(eq(certificates.id, newId), sql`true`));
      },
    );
  });

  it("failing access-log insert inside a read does not break the surrounding query", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = ctx({
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    });

    await withDb(access, async () => {
      // Mimic writeAccessLog's nested SAVEPOINT: INSERT that violates RLS
      // WITH CHECK (user_id must equal app.user_id).
      let insertFailed = false;
      try {
        await withSavepoint("access_log_write", async () => {
          await getDb().insert(accessLogs).values({
            userId: fixtures.users.vesselUserB,
            moduleName: "crew",
            recordId: fixtures.crewA,
            accessType: "view",
          });
        });
      } catch {
        insertFailed = true;
      }
      expect(insertFailed).toBe(true);

      // Outer transaction must still be usable (not aborted).
      const rows = await getDb()
        .select({ id: certificates.id })
        .from(certificates);
      expect(rows.map((r) => r.id)).toEqual([fixtures.certA]);

      // Successful nested writeAccessLog also must not open a second issue.
      await writeAccessLog(access, {
        moduleName: "crew",
        recordId: fixtures.crewA,
        accessType: "view",
      });
      const after = await getDb()
        .select({ id: certificates.id })
        .from(certificates);
      expect(after).toHaveLength(1);
    });
  });
});
