/**
 * Crew certificate controller — module access + vessel scope (real access helpers).
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
  createCrewCertificate,
  deleteCrewCertificate,
  getCrewCertificateById,
  listCrewCertificates,
  updateCrewCertificate,
} from "./crew-certificate.controller";

const VESSEL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VESSEL_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MEMBER_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const CERT_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

const UNAUTH = { userId: "", role: "admin" as const, vesselId: null };
const ADMIN = { userId: USER, role: "admin" as const, vesselId: null };

function certRow() {
  return {
    id: CERT_ID,
    crewMemberId: MEMBER_ID,
    name: "STCW",
    documentNumber: null,
    issuingAuthority: null,
    endorsementTypeId: null,
    issueDate: null,
    expiryDate: "2027-01-01",
    cachedStatus: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Select used by assertCrewMemberAccess / assertCrewCertificateAccess. */
function selectVessel(vesselId: string) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ vesselId }],
        }),
        innerJoin: () => ({
          where: () => ({
            limit: async () => [{ vesselId }],
          }),
        }),
      }),
    }),
  };
}

describe("crew-certificate MODULE_PERMISSIONS oracle", () => {
  it("shares the crew module matrix", () => {
    expect(MODULE_PERMISSIONS.read_only.crew).toBe("read");
    expect(MODULE_PERMISSIONS.vessel_user.crew).toBe("read");
    expect(MODULE_PERMISSIONS.management_user.crew).toBe("read");
    expect(MODULE_PERMISSIONS.admin.crew).toBe("write");
  });
});

describe("crew-certificate.controller access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listCrewCertificates denies unauthenticated", async () => {
    await expect(listCrewCertificates(UNAUTH, MEMBER_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("listCrewCertificates denies null role (module none)", async () => {
    await expect(
      listCrewCertificates(
        { userId: USER, role: null, vesselId: null },
        MEMBER_ID,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["vessel_user", "management_user", "read_only"] as const)(
    "createCrewCertificate ForbiddenError for %s (crew:read)",
    async (role) => {
      getDb.mockReturnValue(selectVessel(VESSEL_A));
      await expect(
        createCrewCertificate(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          {
            crewMemberId: MEMBER_ID,
            name: "STCW",
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user"] as const)(
    "listCrewCertificates vessel-scope ForbiddenError for %s on another vessel",
    async (role) => {
      getDb.mockReturnValue(selectVessel(VESSEL_B));
      await expect(
        listCrewCertificates(
          { userId: USER, role, vesselId: VESSEL_A },
          MEMBER_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user"] as const)(
    "getCrewCertificateById vessel-scope ForbiddenError for %s on another vessel",
    async (role) => {
      getDb.mockReturnValue(selectVessel(VESSEL_B));
      await expect(
        getCrewCertificateById(
          { userId: USER, role, vesselId: VESSEL_A },
          CERT_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user", "read_only"] as const)(
    "updateCrewCertificate ForbiddenError for %s (crew:read)",
    async (role) => {
      getDb.mockReturnValue(selectVessel(VESSEL_A));
      await expect(
        updateCrewCertificate(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          CERT_ID,
          { name: "Renamed" },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user", "read_only"] as const)(
    "deleteCrewCertificate ForbiddenError for %s (crew:read)",
    async (role) => {
      getDb.mockReturnValue(selectVessel(VESSEL_A));
      await expect(
        deleteCrewCertificate(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          CERT_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("listCrewCertificates happy path for admin", async () => {
    const cert = certRow();
    let selectN = 0;
    getDb.mockReturnValue({
      select: () => {
        selectN += 1;
        if (selectN === 1) {
          // assertCrewMemberAccess
          return {
            from: () => ({
              where: () => ({
                limit: async () => [{ vesselId: VESSEL_A }],
              }),
            }),
          };
        }
        return {
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                orderBy: async () => [
                  { cert, endorsementTypeName: null },
                ],
              }),
            }),
          }),
        };
      },
    });

    const rows = await listCrewCertificates(ADMIN, MEMBER_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(CERT_ID);
    expect(rows[0]?.compliance).toBeDefined();
  });

  it("createCrewCertificate happy path for admin", async () => {
    const created = certRow();
    let selectN = 0;
    getDb.mockReturnValue({
      select: () => {
        selectN += 1;
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ vesselId: VESSEL_A }],
            }),
          }),
        };
      },
      insert: () => ({
        values: () => ({
          returning: async () => [created],
        }),
      }),
      update: () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    });

    const row = await createCrewCertificate(ADMIN, {
      crewMemberId: MEMBER_ID,
      name: "STCW",
      expiryDate: "2027-01-01",
    });
    expect(row.id).toBe(CERT_ID);
    expect(selectN).toBeGreaterThanOrEqual(1);
  });
});
