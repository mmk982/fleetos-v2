/**
 * A-12 / A-13: RESTRICT deletes return conflict without unlinking files;
 * successful deletes remove the row then files.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { mkdir, writeFile, access, constants } from "node:fs/promises";
import path from "node:path";
import { closeDb, getDb, withDb } from "@/db/client";
import {
  ismTemplateAttachments,
  ismTemplates,
  vessels,
} from "@/db/schema";
import type { AccessContext } from "@/lib/auth/access";
import {
  createIsmTemplate,
  deleteIsmTemplate,
  IsmTemplateConflictError,
} from "@/modules/ism-templates/ismTemplate.controller";
import {
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
    console.warn("Skipping delete-restrict tests: Postgres unreachable.");
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

describe("delete ordering + RESTRICT → conflict", () => {
  it("ISM template referenced by monthly requirement → Conflict; file stays", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();

    const rel = `data/attachments/a12-ism-${Date.now()}.pdf`;
    const abs = path.join(process.cwd(), rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.from("%PDF-1.4 a12-probe"));

    await withDb(adminCtx(), async () => {
      await getDb().insert(ismTemplateAttachments).values({
        ismTemplateId: fixtures.ismTemplateId,
        fileName: "a12.pdf",
        filePath: rel,
        uploadedBy: fixtures.users.admin,
      });
    });

    await expect(
      deleteIsmTemplate(adminCtx(), fixtures.ismTemplateId),
    ).rejects.toBeInstanceOf(IsmTemplateConflictError);

    await access(abs, constants.F_OK);

    const stillThere = await withDb(adminCtx(), async () => {
      return getDb()
        .select({ id: ismTemplates.id })
        .from(ismTemplates)
        .where(eq(ismTemplates.id, fixtures.ismTemplateId));
    });
    expect(stillThere).toHaveLength(1);
  });

  it("vessel with dependents → VesselConflictError (second RESTRICT module)", async ({
    skip,
  }) => {
    if (!dbAvailable) skip();

    await expect(
      deleteVessel(adminCtx(), fixtures.vesselA),
    ).rejects.toBeInstanceOf(VesselConflictError);

    const still = await withDb(adminCtx(), async () => {
      return getDb()
        .select({ id: vessels.id })
        .from(vessels)
        .where(eq(vessels.id, fixtures.vesselA));
    });
    expect(still).toHaveLength(1);
  });

  it("successful ISM delete removes row then file", async ({ skip }) => {
    if (!dbAvailable) skip();

    // Create a disposable template with no monthly FK, one attachment.
    const categoryId = await withDb(adminCtx(), async () => {
      const rows = await getDb()
        .select({ categoryId: ismTemplates.categoryId })
        .from(ismTemplates)
        .where(eq(ismTemplates.id, fixtures.ismTemplateId))
        .limit(1);
      return rows[0]!.categoryId;
    });
    const created = await createIsmTemplate(adminCtx(), {
      formName: `A12 disposable ${Date.now()}`,
      formCode: `A12-${Date.now()}`,
      categoryId,
      status: "draft",
    });

    const rel = `data/attachments/a12-ok-${Date.now()}.pdf`;
    const abs = path.join(process.cwd(), rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.from("%PDF-1.4 ok"));

    await withDb(adminCtx(), async () => {
      await getDb().insert(ismTemplateAttachments).values({
        ismTemplateId: created.id,
        fileName: "ok.pdf",
        filePath: rel,
        uploadedBy: fixtures.users.admin,
      });
    });

    await deleteIsmTemplate(adminCtx(), created.id);

    const gone = await withDb(adminCtx(), async () => {
      return getDb()
        .select({ id: ismTemplates.id })
        .from(ismTemplates)
        .where(eq(ismTemplates.id, created.id));
    });
    expect(gone).toEqual([]);

    await expect(access(abs, constants.F_OK)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
