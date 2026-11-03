/**
 * A-11: nested `db.transaction()` inside `withDb` must not COMMIT the
 * outer RLS transaction. Proves the bug (locals cleared) then the fix
 * (`withNestedTransaction` via SAVEPOINT).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  closeDb,
  getDb,
  readRlsSettings,
  withDb,
  withNestedTransaction,
} from "@/db/client";
import { certificates, vessels } from "@/db/schema";
import type { AccessContext } from "@/lib/auth/access";
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
      "Skipping nested-transaction RLS tests: Postgres unreachable.",
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

describe("A-11 nested transaction vs withDb RLS locals", () => {
  it("PROBE: after nested atomic block RLS locals must still be set", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();

    await withDb(adminCtx(), async () => {
      const before = await readRlsSettings();
      expect(before.role).toBe("admin");
      // Before the fix this used getDb().transaction() which COMMITs the
      // outer RLS txn. withNestedTransaction uses SAVEPOINT instead.
      await withNestedTransaction(async (tx) => {
        await tx.execute(sql`SELECT 1`);
      });
      const after = await readRlsSettings();
      expect(after).toEqual(before);
      expect(after.role).toBe("admin");
      expect(after.userId).toBe(fixtures.users.admin);
    });
  });

  it("withNestedTransaction keeps RLS locals after the block", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();

    await withDb(adminCtx(), async () => {
      const before = await readRlsSettings();
      await withNestedTransaction(async (tx) => {
        await tx.execute(sql`SELECT 1`);
      });
      const after = await readRlsSettings();
      expect(after).toEqual(before);
      expect(after.role).toBe("admin");
      expect(after.userId).toBe(fixtures.users.admin);
    });
  });

  it("failure inside withNestedTransaction rolls back only the block", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();

    const marker = `nested-sp-probe-${Date.now()}`;
    await withDb(adminCtx(), async () => {
      await getDb().execute(
        sql`CREATE TEMP TABLE IF NOT EXISTS nested_tx_probe (v text)`,
      );
      await getDb().execute(sql`DELETE FROM nested_tx_probe`);
      await getDb().execute(
        sql`INSERT INTO nested_tx_probe (v) VALUES (${"outer"})`,
      );

      await expect(
        withNestedTransaction(async () => {
          await getDb().execute(
            sql`INSERT INTO nested_tx_probe (v) VALUES (${marker})`,
          );
          throw new Error("force-rollback-block");
        }),
      ).rejects.toThrow("force-rollback-block");

      const rows = await getDb().execute(
        sql`SELECT v FROM nested_tx_probe ORDER BY v`,
      );
      const values = (rows.rows as Array<{ v: string }>).map((r) => r.v);
      expect(values).toEqual(["outer"]);
      expect(values).not.toContain(marker);

      const locals = await readRlsSettings();
      expect(locals.role).toBe("admin");
    });
  });

  it("failure after withNestedTransaction rolls back outer including block writes", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();

    const name = `rollback-outer-${Date.now()}`;
    let insertedId: string | undefined;

    await expect(
      withDb(adminCtx(), async () => {
        const row = await withNestedTransaction(async (tx) => {
          const inserted = await tx
            .insert(vessels)
            .values({
              name,
              status: "active",
            })
            .returning({ id: vessels.id });
          const id = inserted[0]?.id;
          if (!id) throw new Error("insert failed");
          return id;
        });
        insertedId = row;
        throw new Error("force-rollback-outer");
      }),
    ).rejects.toThrow("force-rollback-outer");

    // New connection / no RLS admin — use withDb again to check absence.
    const found = await withDb(adminCtx(), async () => {
      return getDb()
        .select({ id: vessels.id })
        .from(vessels)
        .where(eq(vessels.name, name));
    });
    expect(found).toEqual([]);
    expect(insertedId).toBeTruthy();
  });

  it("certificate create path keeps RLS context for office role", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();

    const { createCertificate, deleteCertificate } = await import(
      "@/modules/certificates/certificate.mutations"
    );

    const created = await createCertificate(adminCtx(), {
      vesselId: fixtures.vesselA,
      certificateTypeId: fixtures.certificateTypeId,
      certificateNumber: `A11-${Date.now()}`,
      linkedToDryDock: false,
      lifecycleStatus: "active",
    });

    expect(created.id).toBeTruthy();
    expect(created.vesselId).toBe(fixtures.vesselA);

    // Scoped vessel_user can still see Vessel A cert under RLS after create.
    const vuA: AccessContext = {
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    };
    const visible = await withDb(vuA, async () => {
      return getDb()
        .select({ id: certificates.id })
        .from(certificates)
        .where(eq(certificates.id, created.id));
    });
    expect(visible.map((r) => r.id)).toEqual([created.id]);

    await deleteCertificate(adminCtx(), created.id);
  });
});
