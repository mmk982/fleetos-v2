/**
 * Crew controller — module access + vessel scope (real access helpers).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/activity-log/write", () => ({
  writeActivityLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/access-log/write", () => ({
  writeAccessLog: vi.fn(async () => undefined),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
  withDb: async (_ctx: unknown, fn: (db: unknown) => unknown) => fn(getDb()),
}));

import { ForbiddenError } from "@/lib/auth/access";
import { MODULE_PERMISSIONS } from "@/lib/auth/permissions";
import {
  createCrewMember,
  deleteCrewMember,
  getCrewMemberById,
  listCrewMembers,
  updateCrewMember,
} from "./crew.controller";

const VESSEL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VESSEL_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MEMBER_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const UNAUTH = { userId: "", role: "admin" as const, vesselId: null };
const ADMIN = { userId: USER, role: "admin" as const, vesselId: null };

function memberRow(vesselId: string) {
  return {
    id: MEMBER_ID,
    firstName: "Ada",
    lastName: "Lovelace",
    categoryId: null,
    nationality: null,
    dateOfBirth: null,
    vesselId,
    status: "active" as const,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("crew MODULE_PERMISSIONS oracle", () => {
  it("documents coarse access used by these tests", () => {
    expect(MODULE_PERMISSIONS.admin.crew).toBe("write");
    expect(MODULE_PERMISSIONS.superintendent.crew).toBe("write");
    expect(MODULE_PERMISSIONS.management_user.crew).toBe("read");
    expect(MODULE_PERMISSIONS.vessel_user.crew).toBe("read");
    expect(MODULE_PERMISSIONS.read_only.crew).toBe("read");
  });
});

describe("crew.controller access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listCrewMembers denies unauthenticated", async () => {
    await expect(listCrewMembers(UNAUTH)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("listCrewMembers denies null role (module none)", async () => {
    await expect(
      listCrewMembers({ userId: USER, role: null, vesselId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["vessel_user", "management_user", "read_only"] as const)(
    "createCrewMember ForbiddenError for %s (crew:read)",
    async (role) => {
      await expect(
        createCrewMember(
          { userId: USER, role, vesselId: role === "read_only" ? null : VESSEL_A },
          {
            firstName: "Ada",
            lastName: "Lovelace",
            vesselId: VESSEL_A,
            status: "active",
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user"] as const)(
    "getCrewMemberById vessel-scope ForbiddenError for %s on another vessel",
    async (role) => {
      getDb.mockReturnValue({
        select: () => ({
          from: () => ({
            leftJoin: () => ({
              leftJoin: () => ({
                where: () => ({
                  limit: async () => [
                    {
                      member: memberRow(VESSEL_B),
                      vesselName: "Beta",
                      categoryName: null,
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      });

      await expect(
        getCrewMemberById(
          { userId: USER, role, vesselId: VESSEL_A },
          MEMBER_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user"] as const)(
    "updateCrewMember ForbiddenError for %s (crew:read)",
    async (role) => {
      await expect(
        updateCrewMember(
          { userId: USER, role, vesselId: VESSEL_A },
          MEMBER_ID,
          { firstName: "Renamed" },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user", "read_only"] as const)(
    "deleteCrewMember ForbiddenError for %s (crew:read)",
    async (role) => {
      await expect(
        deleteCrewMember(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          MEMBER_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("listCrewMembers happy path for admin", async () => {
    const member = memberRow(VESSEL_A);
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: () => ({
                orderBy: async () => [
                  {
                    member,
                    vesselName: "Alpha",
                    categoryName: null,
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    });

    const rows = await listCrewMembers(ADMIN);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(MEMBER_ID);
    expect(rows[0]?.vesselName).toBe("Alpha");
  });

  it("getCrewMemberById happy path for admin", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    member: memberRow(VESSEL_A),
                    vesselName: "Alpha",
                    categoryName: null,
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    });

    const row = await getCrewMemberById(ADMIN, MEMBER_ID);
    expect(row?.id).toBe(MEMBER_ID);
  });

  it("createCrewMember happy path for admin", async () => {
    const created = memberRow(VESSEL_A);
    getDb.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => [created],
        }),
      }),
    });

    const row = await createCrewMember(ADMIN, {
      firstName: "Ada",
      lastName: "Lovelace",
      vesselId: VESSEL_A,
      status: "active",
    });
    expect(row.id).toBe(MEMBER_ID);
  });
});
