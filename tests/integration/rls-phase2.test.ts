/**
 * Phase-2 RLS integration tests (real Postgres).
 * Must fail before migration 0026 is applied; pass after.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb, withDb, withSavepoint, withSystemDb } from "@/db/client";
import {
  audits,
  certificateAttachments,
  certificateEvents,
  deficiencies,
  deficiencyAttachments,
  drawingAttachments,
  drawings,
  insuranceAttachments,
  insurancePolicies,
  manualRevisions,
  manuals,
  monthlyExecutedFormAttachments,
  monthlyExecutedForms,
  monthlyFormRequirements,
  notifications,
  pscInspections,
  reminders,
  vesselNotes,
  vesselParticulars,
  vesselParticularsAttachments,
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
      "Skipping RLS phase-2 integration tests: Postgres unreachable.",
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

describe("RLS phase 2", () => {
  it("skips cleanly when DB is down", ({ skip }) => {
    if (!dbAvailable) {
      skip("Postgres unreachable");
    }
    expect(dbAvailable).toBe(true);
  });

  it("scoped vessel_user on A sees only A rows across phase-2 tables", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = ctx({
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    });

    await withDb(access, async () => {
      expect(
        (await getDb().select({ id: certificateEvents.id }).from(certificateEvents)).map(
          (r) => r.id,
        ),
      ).toEqual([fixtures.certEventA]);
      expect(
        (
          await getDb()
            .select({ id: certificateAttachments.id })
            .from(certificateAttachments)
        ).map((r) => r.id),
      ).toEqual([fixtures.certAttachA]);

      expect(
        (await getDb().select({ id: deficiencies.id }).from(deficiencies)).map(
          (r) => r.id,
        ),
      ).toEqual([fixtures.deficiencyA]);
      expect(
        (
          await getDb()
            .select({ id: deficiencyAttachments.id })
            .from(deficiencyAttachments)
        ).map((r) => r.id),
      ).toEqual([fixtures.deficiencyAttachA]);

      expect(
        (
          await getDb().select({ id: insurancePolicies.id }).from(insurancePolicies)
        ).map((r) => r.id),
      ).toEqual([fixtures.insuranceA]);
      expect(
        (
          await getDb()
            .select({ id: insuranceAttachments.id })
            .from(insuranceAttachments)
        ).map((r) => r.id),
      ).toEqual([fixtures.insuranceAttachA]);

      expect(
        (await getDb().select({ id: manuals.id }).from(manuals)).map((r) => r.id),
      ).toEqual([fixtures.manualA]);
      expect(
        (await getDb().select({ id: manualRevisions.id }).from(manualRevisions)).map(
          (r) => r.id,
        ),
      ).toEqual([fixtures.manualRevisionA]);

      expect(
        (await getDb().select({ id: drawings.id }).from(drawings)).map((r) => r.id),
      ).toEqual([fixtures.drawingA]);
      expect(
        (
          await getDb().select({ id: drawingAttachments.id }).from(drawingAttachments)
        ).map((r) => r.id),
      ).toEqual([fixtures.drawingAttachA]);

      expect(
        (
          await getDb()
            .select({ id: monthlyFormRequirements.id })
            .from(monthlyFormRequirements)
        ).map((r) => r.id),
      ).toEqual([fixtures.monthlyReqA]);
      expect(
        (
          await getDb()
            .select({ id: monthlyExecutedForms.id })
            .from(monthlyExecutedForms)
        ).map((r) => r.id),
      ).toEqual([fixtures.monthlyFormA]);
      expect(
        (
          await getDb()
            .select({ id: monthlyExecutedFormAttachments.id })
            .from(monthlyExecutedFormAttachments)
        ).map((r) => r.id),
      ).toEqual([fixtures.monthlyAttachA]);

      expect(
        (
          await getDb().select({ id: vesselParticulars.id }).from(vesselParticulars)
        ).map((r) => r.id),
      ).toEqual([fixtures.particularsA]);
      expect(
        (
          await getDb()
            .select({ id: vesselParticularsAttachments.id })
            .from(vesselParticularsAttachments)
        ).map((r) => r.id),
      ).toEqual([fixtures.particularsAttachA]);
      expect(
        (await getDb().select({ id: vesselNotes.id }).from(vesselNotes)).map(
          (r) => r.id,
        ),
      ).toEqual([fixtures.noteA]);

      const remIds = (
        await getDb().select({ id: reminders.id }).from(reminders)
      ).map((r) => r.id);
      expect(remIds).toEqual([fixtures.reminderA]);
      expect(remIds).not.toContain(fixtures.reminderFleet);

      expect(
        (await getDb().select({ id: audits.id }).from(audits)).map((r) => r.id),
      ).toEqual([fixtures.auditA]);
      expect(
        (await getDb().select({ id: pscInspections.id }).from(pscInspections)).map(
          (r) => r.id,
        ),
      ).toEqual([fixtures.pscA]);

      const notifIds = (
        await getDb().select({ id: notifications.id }).from(notifications)
      ).map((r) => r.id);
      expect(notifIds).toContain(fixtures.notifA);
      expect(notifIds).not.toContain(fixtures.notifB);
    });
  });

  it("scoped user cannot read/write B deficiencies or move vessel", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const access = ctx({
      userId: fixtures.users.vesselUserA,
      role: "vessel_user",
      vesselId: fixtures.vesselA,
    });
    await withDb(access, async () => {
      expect(
        await getDb()
          .select({ id: deficiencies.id })
          .from(deficiencies)
          .where(eq(deficiencies.id, fixtures.deficiencyB)),
      ).toEqual([]);

      let threw = false;
      try {
        await withSavepoint("insert_b", async () => {
          await getDb().insert(deficiencies).values({
            vesselId: fixtures.vesselB,
            title: "leak",
            sourceId: fixtures.deficiencySourceId,
            status: "open",
          });
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);

      // USING blocks the row (0 updated) and/or WITH CHECK throws — either
      // way the vessel_id must stay A.
      let moved: { id: string }[] = [];
      try {
        await withSavepoint("move_vessel", async () => {
          moved = await getDb()
            .update(deficiencies)
            .set({ vesselId: fixtures.vesselB })
            .where(eq(deficiencies.id, fixtures.deficiencyA))
            .returning({ id: deficiencies.id });
        });
      } catch {
        moved = [];
      }
      expect(moved).toEqual([]);
      const stillA = await getDb()
        .select({ vesselId: deficiencies.vesselId })
        .from(deficiencies)
        .where(eq(deficiencies.id, fixtures.deficiencyA));
      expect(stillA[0]?.vesselId).toBe(fixtures.vesselA);

      const deleted = await getDb()
        .delete(deficiencies)
        .where(eq(deficiencies.id, fixtures.deficiencyB))
        .returning({ id: deficiencies.id });
      expect(deleted).toEqual([]);
    });
  });

  it("child attachment on B parent is unreachable", async ({ skip }) => {
    if (!dbAvailable) skip();
    await withDb(
      ctx({
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: fixtures.vesselA,
      }),
      async () => {
        expect(
          await getDb()
            .select({ id: deficiencyAttachments.id })
            .from(deficiencyAttachments)
            .where(eq(deficiencyAttachments.id, fixtures.deficiencyAttachB)),
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: certificateAttachments.id })
            .from(certificateAttachments)
            .where(eq(certificateAttachments.id, fixtures.certAttachB)),
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: manualRevisions.id })
            .from(manualRevisions)
            .where(eq(manualRevisions.id, fixtures.manualRevisionB)),
        ).toEqual([]);
      },
    );
  });

  it("office sees both; read_only cannot write deficiencies", async ({
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
        const ids = (
          await getDb().select({ id: deficiencies.id }).from(deficiencies)
        ).map((r) => r.id);
        expect(ids.sort()).toEqual(
          [fixtures.deficiencyA, fixtures.deficiencyB].sort(),
        );
        const rem = (
          await getDb().select({ id: reminders.id }).from(reminders)
        ).map((r) => r.id);
        expect(rem).toContain(fixtures.reminderFleet);
      },
    );

    await withDb(
      ctx({
        userId: fixtures.users.readOnly,
        role: "read_only",
        vesselId: null,
      }),
      async () => {
        expect(
          await getDb().select({ id: deficiencies.id }).from(deficiencies),
        ).toHaveLength(2);
        let threw = false;
        try {
          await getDb().insert(deficiencies).values({
            vesselId: fixtures.vesselA,
            title: "ro-write",
            sourceId: fixtures.deficiencySourceId,
            status: "open",
          });
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);
      },
    );
  });

  it("management_user can write deficiencies on A but not certificates", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const newId = crypto.randomUUID();
    await withDb(
      ctx({
        userId: fixtures.users.managementA,
        role: "management_user",
        vesselId: fixtures.vesselA,
      }),
      async () => {
        await getDb().insert(deficiencies).values({
          id: newId,
          vesselId: fixtures.vesselA,
          title: "mgmt write",
          sourceId: fixtures.deficiencySourceId,
          status: "open",
        });
        expect(
          await getDb()
            .select({ id: deficiencies.id })
            .from(deficiencies)
            .where(eq(deficiencies.id, newId)),
        ).toHaveLength(1);
        await getDb().delete(deficiencies).where(eq(deficiencies.id, newId));

        let threw = false;
        try {
          await getDb().insert(insurancePolicies).values({
            vesselId: fixtures.vesselA,
            policyType: "hm",
          });
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);
      },
    );
  });

  it("vessel_user can write monthly executed forms on A; not requirements; not notes", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const formId = crypto.randomUUID();
    await withDb(
      ctx({
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: fixtures.vesselA,
      }),
      async () => {
        await getDb().insert(monthlyExecutedForms).values({
          id: formId,
          vesselId: fixtures.vesselA,
          ismTemplateId: fixtures.ismTemplateId,
          formName: "VU submit",
          month: 2,
          year: 2030,
          status: "pending",
        });
        expect(
          await getDb()
            .select({ id: monthlyExecutedForms.id })
            .from(monthlyExecutedForms)
            .where(eq(monthlyExecutedForms.id, formId)),
        ).toHaveLength(1);
        await getDb()
          .delete(monthlyExecutedForms)
          .where(eq(monthlyExecutedForms.id, formId));

        let reqThrew = false;
        try {
          await getDb().insert(monthlyFormRequirements).values({
            vesselId: fixtures.vesselA,
            ismTemplateId: fixtures.ismTemplateId,
            frequency: "quarterly",
          });
        } catch {
          reqThrew = true;
        }
        expect(reqThrew).toBe(true);

        let noteThrew = false;
        try {
          await getDb().insert(vesselNotes).values({
            vesselId: fixtures.vesselA,
            body: "vu note",
            authorId: fixtures.users.vesselUserA,
          });
        } catch {
          noteThrew = true;
        }
        expect(noteThrew).toBe(true);
      },
    );
  });

  it("fail-closed: no context → zero rows on phase-2 tables", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    expect(await getDb().select({ id: deficiencies.id }).from(deficiencies)).toEqual(
      [],
    );
    expect(await getDb().select({ id: notifications.id }).from(notifications)).toEqual(
      [],
    );
    expect(await getDb().select({ id: reminders.id }).from(reminders)).toEqual([]);
  });

  it("vessel-less scoped user → zero phase-2 rows", async ({ skip }) => {
    if (!dbAvailable) skip();
    await withDb(
      ctx({
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: null,
      }),
      async () => {
        expect(
          await getDb().select({ id: deficiencies.id }).from(deficiencies),
        ).toEqual([]);
        expect(await getDb().select({ id: manuals.id }).from(manuals)).toEqual([]);
      },
    );
  });

  it("notifications: user A never sees user B rows", async ({ skip }) => {
    if (!dbAvailable) skip();
    await withDb(
      ctx({
        userId: fixtures.users.vesselUserA,
        role: "vessel_user",
        vesselId: fixtures.vesselA,
      }),
      async () => {
        const ids = (
          await getDb().select({ id: notifications.id }).from(notifications)
        ).map((r) => r.id);
        expect(ids).toEqual([fixtures.notifA]);
      },
    );
  });

  it("forgetting assertVesselScope still cannot leak B (deficiencies)", async ({
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
        expect(
          await getDb()
            .select({ id: deficiencies.id })
            .from(deficiencies)
            .where(eq(deficiencies.id, fixtures.deficiencyB)),
        ).toEqual([]);
      },
    );
  });

  it("system role can SELECT phase-2 vessel tables and insert notifications", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();
    const id = crypto.randomUUID();
    await withSystemDb("integration-test", async () => {
      expect(
        await getDb().select({ id: deficiencies.id }).from(deficiencies),
      ).toHaveLength(2);
      await getDb().insert(notifications).values({
        id,
        userId: fixtures.users.vesselUserB,
        vesselId: fixtures.vesselB,
        recordId: fixtures.certB,
        title: "system sync",
        notificationType: "reminder",
        cycleKey: "sys",
      });
      await getDb().delete(notifications).where(eq(notifications.id, id));
    });
  });
});
