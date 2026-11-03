/**
 * PSC controller — module access + vessel scope (real access helpers).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/activity-log/write", () => ({
  writeActivityLog: vi.fn(async () => undefined),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
  withDb: async (_ctx: unknown, fn: (db: unknown) => unknown) => fn(getDb()),
}));

import { ForbiddenError } from "@/lib/auth/access";
import { MODULE_PERMISSIONS } from "@/lib/auth/permissions";
import {
  createPscInspection,
  deletePscInspection,
  getPscInspection,
  listPscInspections,
  updatePscInspection,
} from "./psc.controller";

const VESSEL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VESSEL_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const PSC_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const UNAUTH = { userId: "", role: "admin" as const, vesselId: null };
const ADMIN = { userId: USER, role: "admin" as const, vesselId: null };

function pscRow(vesselId: string) {
  return {
    id: PSC_ID,
    vesselId,
    port: "Rotterdam",
    inspectionDate: "2026-05-01",
    authority: "NL",
    result: "no_deficiencies" as const,
    detained: false,
    inspectorName: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("psc MODULE_PERMISSIONS oracle", () => {
  it("documents coarse access used by these tests", () => {
    expect(MODULE_PERMISSIONS.admin.psc).toBe("write");
    expect(MODULE_PERMISSIONS.management_user.psc).toBe("write");
    expect(MODULE_PERMISSIONS.vessel_user.psc).toBe("read");
    expect(MODULE_PERMISSIONS.read_only.psc).toBe("read");
  });
});

describe("psc.controller access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listPscInspections denies unauthenticated", async () => {
    await expect(listPscInspections(UNAUTH)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("listPscInspections denies null role (module none)", async () => {
    await expect(
      listPscInspections({ userId: USER, role: null, vesselId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["vessel_user", "read_only"] as const)(
    "createPscInspection ForbiddenError for %s (psc:read)",
    async (role) => {
      await expect(
        createPscInspection(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          {
            vesselId: VESSEL_A,
            port: "Rotterdam",
            inspectionDate: "2026-05-01",
            authority: "NL",
            result: "no_deficiencies",
            detained: false,
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("createPscInspection vessel-scope ForbiddenError for management_user on another vessel", async () => {
    await expect(
      createPscInspection(
        { userId: USER, role: "management_user", vesselId: VESSEL_A },
        {
          vesselId: VESSEL_B,
          port: "Rotterdam",
          inspectionDate: "2026-05-01",
          authority: "NL",
          result: "no_deficiencies",
          detained: false,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["vessel_user", "management_user"] as const)(
    "getPscInspection vessel-scope ForbiddenError for %s on another vessel",
    async (role) => {
      getDb.mockReturnValue({
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    inspection: pscRow(VESSEL_B),
                    vesselName: "Beta",
                  },
                ],
              }),
            }),
          }),
        }),
      });

      await expect(
        getPscInspection(
          { userId: USER, role, vesselId: VESSEL_A },
          PSC_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "read_only"] as const)(
    "updatePscInspection ForbiddenError for %s (psc:read)",
    async (role) => {
      await expect(
        updatePscInspection(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          PSC_ID,
          { notes: "x" },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "read_only"] as const)(
    "deletePscInspection ForbiddenError for %s (psc:read)",
    async (role) => {
      await expect(
        deletePscInspection(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          PSC_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("listPscInspections happy path for admin", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: async () => [
                { inspection: pscRow(VESSEL_A), vesselName: "Alpha" },
              ],
            }),
          }),
        }),
      }),
    });

    const rows = await listPscInspections(ADMIN);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(PSC_ID);
  });

  it("createPscInspection happy path for admin", async () => {
    const created = pscRow(VESSEL_A);
    getDb.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => [created],
        }),
      }),
    });

    const row = await createPscInspection(ADMIN, {
      vesselId: VESSEL_A,
      port: "Rotterdam",
      inspectionDate: "2026-05-01",
      authority: "NL",
      result: "no_deficiencies",
      detained: false,
    });
    expect(row.id).toBe(PSC_ID);
  });
});
