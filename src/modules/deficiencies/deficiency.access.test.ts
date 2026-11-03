/**
 * Deficiency controller — module access + vessel scope (real access helpers).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/activity-log/write", () => ({
  writeActivityLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/attachments/stream", () => ({
  removeStoredAttachmentFile: vi.fn(async () => undefined),
  openStoredAttachmentStream: vi.fn(),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
  withDb: async (_ctx: unknown, fn: (db: unknown) => unknown) => fn(getDb()),
}));

import { ForbiddenError } from "@/lib/auth/access";
import { MODULE_PERMISSIONS } from "@/lib/auth/permissions";
import {
  createDeficiency,
  deleteDeficiency,
  getDeficiencyById,
  listDeficiencies,
  updateDeficiency,
} from "./deficiency.controller";

const VESSEL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VESSEL_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const DEF_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const SOURCE_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

const UNAUTH = { userId: "", role: "admin" as const, vesselId: null };
const ADMIN = { userId: USER, role: "admin" as const, vesselId: null };

function deficiencyRow(vesselId: string) {
  return {
    id: DEF_ID,
    vesselId,
    title: "Fire door gap",
    sourceId: SOURCE_ID,
    status: "open" as const,
    deficiencyNumber: null,
    category: null,
    description: null,
    reference: null,
    identifiedDate: null,
    dueDate: null,
    closedDate: null,
    correctiveAction: null,
    responsiblePerson: null,
    notes: null,
    pscInspectionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function vesselRow(id: string, name = "Alpha") {
  return {
    id,
    name,
    imoNumber: null,
    mmsi: null,
    callSign: null,
    flagState: null,
    vesselType: null,
    grossTonnage: null,
    yearBuilt: null,
    status: "active" as const,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("deficiency MODULE_PERMISSIONS oracle", () => {
  it("documents coarse access used by these tests", () => {
    expect(MODULE_PERMISSIONS.admin.deficiencies).toBe("write");
    expect(MODULE_PERMISSIONS.management_user.deficiencies).toBe("write");
    expect(MODULE_PERMISSIONS.vessel_user.deficiencies).toBe("read");
    expect(MODULE_PERMISSIONS.read_only.deficiencies).toBe("read");
  });
});

describe("deficiency.controller access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listDeficiencies denies unauthenticated", async () => {
    await expect(listDeficiencies(UNAUTH)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("listDeficiencies denies null role (module none)", async () => {
    await expect(
      listDeficiencies({ userId: USER, role: null, vesselId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["vessel_user", "read_only"] as const)(
    "createDeficiency ForbiddenError for %s (deficiencies:read)",
    async (role) => {
      await expect(
        createDeficiency(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          {
            vesselId: VESSEL_A,
            title: "Fire door gap",
            sourceId: SOURCE_ID,
            status: "open",
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("createDeficiency vessel-scope ForbiddenError for management_user on another vessel", async () => {
    await expect(
      createDeficiency(
        { userId: USER, role: "management_user", vesselId: VESSEL_A },
        {
          vesselId: VESSEL_B,
          title: "Fire door gap",
          sourceId: SOURCE_ID,
          status: "open",
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["vessel_user", "management_user"] as const)(
    "getDeficiencyById vessel-scope ForbiddenError for %s on another vessel",
    async (role) => {
      getDb.mockReturnValue({
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  limit: async () => [
                    {
                      deficiency: deficiencyRow(VESSEL_B),
                      vessel: vesselRow(VESSEL_B, "Beta"),
                      sourceName: "Internal",
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      });

      await expect(
        getDeficiencyById(
          { userId: USER, role, vesselId: VESSEL_A },
          DEF_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "read_only"] as const)(
    "updateDeficiency ForbiddenError for %s (deficiencies:read)",
    async (role) => {
      await expect(
        updateDeficiency(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          DEF_ID,
          { title: "Renamed" },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "read_only"] as const)(
    "deleteDeficiency ForbiddenError for %s (deficiencies:read)",
    async (role) => {
      await expect(
        deleteDeficiency(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          DEF_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("listDeficiencies happy path for admin", async () => {
    const deficiency = deficiencyRow(VESSEL_A);
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: async () => [
                  {
                    deficiency,
                    vesselName: "Alpha",
                    sourceName: "Internal",
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    });

    const rows = await listDeficiencies(ADMIN);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(DEF_ID);
  });

  it("createDeficiency happy path for admin", async () => {
    const created = deficiencyRow(VESSEL_A);
    getDb.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => [created],
        }),
      }),
    });

    const row = await createDeficiency(ADMIN, {
      vesselId: VESSEL_A,
      title: "Fire door gap",
      sourceId: SOURCE_ID,
      status: "open",
    });
    expect(row.id).toBe(DEF_ID);
  });
});
