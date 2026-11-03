/**
 * RLS for `vessels` (migration 0030). Real Postgres.
 * Must fail before 0030 is applied; pass after.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  closeDb,
  getDb,
  withDb,
  withSavepoint,
  withSystemDb,
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
    console.warn("Skipping RLS vessels integration tests: Postgres unreachable.");
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

describe("RLS vessels (0030)", () => {
  it("skips cleanly when DB is down", ({ skip }) => {
    if (!dbAvailable) {
      skip("Postgres unreachable");
    }
    expect(dbAvailable).toBe(true);
  });

  it("fail-closed: no context → 0 vessel rows and cannot insert", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const rows = await getDb().select({ id: vessels.id }).from(vessels);
    expect(rows).toEqual([]);

    // Bare insert has no withDb mapping — expect raw RLS SQLSTATE 42501.
    let code: string | undefined;
    try {
      await getDb().insert(vessels).values({
        name: "No-context leak",
        status: "active",
      });
    } catch (error) {
      const e = error as { code?: string; cause?: { code?: string } };
      code = e.code ?? e.cause?.code;
    }
    expect(code).toBe("42501");
  });

  it("vessel_user / management_user on A see only A; NIL vessel → 0", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();

    await withDb(
      ctx({
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: fixtures.vesselA,
      }),
      async () => {
        const ids = (
          await getDb().select({ id: vessels.id }).from(vessels)
        ).map((r) => r.id);
        expect(ids).toEqual([fixtures.vesselA]);
      },
    );

    await withDb(
      ctx({
        userId: fixtures.users.managementA,
        role: "management_user",
        vesselId: fixtures.vesselA,
      }),
      async () => {
        const ids = (
          await getDb().select({ id: vessels.id }).from(vessels)
        ).map((r) => r.id);
        expect(ids).toEqual([fixtures.vesselA]);
      },
    );

    await withDb(
      ctx({
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: null,
      }),
      async () => {
        expect(await getDb().select({ id: vessels.id }).from(vessels)).toEqual(
          [],
        );
      },
    );
  });

  it("admin / superintendent / read_only see all vessels", async ({ skip }) => {
    if (!dbAvailable) skip();
    const expected = [fixtures.vesselA, fixtures.vesselB].sort();

    for (const role of ["admin", "superintendent", "read_only"] as const) {
      const userId =
        role === "admin"
          ? fixtures.users.admin
          : role === "superintendent"
            ? fixtures.users.superintendent
            : fixtures.users.readOnly;
      await withDb(
        ctx({ userId, role, vesselId: null }),
        async () => {
          const ids = (
            await getDb().select({ id: vessels.id }).from(vessels)
          )
            .map((r) => r.id)
            .sort();
          expect(ids).toEqual(expected);
        },
      );
    }
  });

  it("non-admin INSERT denied (42501); UPDATE/DELETE affect 0 rows", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const { ForbiddenError } = await import("@/lib/auth/access");

    const nonAdmins: Array<{
      userId: string;
      role: AccessContext["role"];
      vesselId: string | null;
    }> = [
      {
        userId: fixtures.users.superintendent,
        role: "superintendent",
        vesselId: null,
      },
      {
        userId: fixtures.users.readOnly,
        role: "read_only",
        vesselId: null,
      },
      {
        userId: fixtures.users.managementA,
        role: "management_user",
        vesselId: fixtures.vesselA,
      },
      {
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: fixtures.vesselA,
      },
    ];

    for (const access of nonAdmins) {
      await expect(
        withDb(ctx(access), async () => {
          await getDb().insert(vessels).values({
            name: `denied-${access.role}`,
            status: "active",
          });
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      await withDb(ctx(access), async () => {
        const updated = await getDb()
          .update(vessels)
          .set({ notes: "should-not-stick" })
          .where(eq(vessels.id, fixtures.vesselA))
          .returning({ id: vessels.id });
        expect(updated).toEqual([]);

        const deleted = await getDb()
          .delete(vessels)
          .where(eq(vessels.id, fixtures.vesselA))
          .returning({ id: vessels.id });
        expect(deleted).toEqual([]);
      });
    }
  });

  it("admin can INSERT / UPDATE / DELETE a throwaway vessel", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = ctx({
      userId: fixtures.users.admin,
      role: "admin",
      vesselId: null,
    });

    await withDb(access, async () => {
      const inserted = await getDb()
        .insert(vessels)
        .values({ name: "RLS-Temp-Vessel", status: "active" })
        .returning({ id: vessels.id });
      const id = inserted[0]?.id;
      expect(id).toBeTruthy();
      if (!id) return;

      const updated = await getDb()
        .update(vessels)
        .set({ notes: "ok" })
        .where(eq(vessels.id, id))
        .returning({ id: vessels.id, notes: vessels.notes });
      expect(updated[0]?.notes).toBe("ok");

      const deleted = await getDb()
        .delete(vessels)
        .where(eq(vessels.id, id))
        .returning({ id: vessels.id });
      expect(deleted).toEqual([{ id }]);
    });
  });

  it("system context can SELECT vessels; cannot INSERT", async ({ skip }) => {
    if (!dbAvailable) skip();
    await withSystemDb("integration-test", async () => {
      const ids = (await getDb().select({ id: vessels.id }).from(vessels)).map(
        (r) => r.id,
      );
      expect(ids.sort()).toEqual(
        [fixtures.vesselA, fixtures.vesselB].sort(),
      );

      let code: string | undefined;
      try {
        await withSavepoint("sys_insert", async () => {
          await getDb().insert(vessels).values({
            name: "sys-should-fail",
            status: "active",
          });
        });
      } catch (error) {
        const e = error as { code?: string; cause?: { code?: string } };
        code = e.code ?? e.cause?.code;
      }
      expect(code).toBe("42501");
    });
  });

  it("scoped join: certificates with vessel name only for own vessel", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    await withDb(
      ctx({
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: fixtures.vesselA,
      }),
      async () => {
        const rows = await getDb()
          .select({
            certId: certificates.id,
            vesselId: vessels.id,
            vesselName: vessels.name,
          })
          .from(certificates)
          .innerJoin(vessels, eq(certificates.vesselId, vessels.id));

        expect(rows.map((r) => r.certId)).toEqual([fixtures.certA]);
        expect(rows.every((r) => r.vesselId === fixtures.vesselA)).toBe(true);
      },
    );
  });
});
