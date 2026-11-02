/**
 * Vessel controller — module access + vessel scope (real access helpers).
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
}));

import {
  ForbiddenError,
  MissingVesselAssignmentError,
} from "@/lib/auth/access";
import {
  createVessel,
  deleteVessel,
  getVesselById,
  listVessels,
  updateVessel,
} from "./vessel.controller";

const VESSEL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VESSEL_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";

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

describe("vessel.controller access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listVessels filters to the assigned vessel for vessel_user", async () => {
    const own = vesselRow(VESSEL_A);
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [own],
          }),
          orderBy: async () => [own, vesselRow(VESSEL_B, "Beta")],
        }),
      }),
    });

    const rows = await listVessels({
      userId: USER,
      role: "vessel_user",
      vesselId: VESSEL_A,
    });
    expect(rows).toEqual([own]);
  });

  it("listVessels throws MissingVesselAssignmentError when scoped role has no vessel", async () => {
    await expect(
      listVessels({ userId: USER, role: "vessel_user", vesselId: null }),
    ).rejects.toBeInstanceOf(MissingVesselAssignmentError);
  });

  it("getVesselById denies another vessel for management_user", async () => {
    await expect(
      getVesselById(
        { userId: USER, role: "management_user", vesselId: VESSEL_A },
        VESSEL_B,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("getVesselById allows own vessel for vessel_user", async () => {
    const own = vesselRow(VESSEL_A);
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [own],
          }),
        }),
      }),
    });

    const row = await getVesselById(
      { userId: USER, role: "vessel_user", vesselId: VESSEL_A },
      VESSEL_A,
    );
    expect(row?.id).toBe(VESSEL_A);
  });

  it.each(["vessel_user", "management_user"] as const)(
    "createVessel ForbiddenError for %s",
    async (role) => {
      await expect(
        createVessel(
          { userId: USER, role, vesselId: VESSEL_A },
          { name: "X", status: "active" },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user"] as const)(
    "updateVessel ForbiddenError for %s",
    async (role) => {
      await expect(
        updateVessel(
          { userId: USER, role, vesselId: VESSEL_A },
          VESSEL_A,
          { name: "Renamed" },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user"] as const)(
    "deleteVessel ForbiddenError for %s",
    async (role) => {
      await expect(
        deleteVessel(
          { userId: USER, role, vesselId: VESSEL_A },
          VESSEL_A,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("createVessel ForbiddenError for superintendent (vessels none)", async () => {
    await expect(
      createVessel(
        { userId: USER, role: "superintendent", vesselId: null },
        { name: "X", status: "active" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("vessel notes write remains particulars:write", () => {
  it("documents that vessel_user/management_user cannot write notes via particulars matrix", async () => {
    const { getModuleAccess } = await import("@/lib/auth/permissions");
    expect(getModuleAccess("vessel_user", "particulars")).toBe("read");
    expect(getModuleAccess("management_user", "particulars")).toBe("read");
    expect(getModuleAccess("admin", "particulars")).toBe("write");
  });
});
