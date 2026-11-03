/**
 * Audit controller — module access + vessel scope (real access helpers).
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
  createAudit,
  deleteAudit,
  getAudit,
  listAudits,
  updateAudit,
} from "./audit.controller";

const VESSEL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VESSEL_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const AUDIT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const UNAUTH = { userId: "", role: "admin" as const, vesselId: null };
const ADMIN = { userId: USER, role: "admin" as const, vesselId: null };

function auditRow(vesselId: string) {
  return {
    id: AUDIT_ID,
    vesselId,
    auditType: "ISSC" as const,
    auditDate: "2026-06-01",
    auditor: null,
    findingsCount: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("audit MODULE_PERMISSIONS oracle", () => {
  it("documents coarse access used by these tests", () => {
    expect(MODULE_PERMISSIONS.admin.audits).toBe("write");
    expect(MODULE_PERMISSIONS.management_user.audits).toBe("write");
    expect(MODULE_PERMISSIONS.vessel_user.audits).toBe("read");
    expect(MODULE_PERMISSIONS.read_only.audits).toBe("read");
  });
});

describe("audit.controller access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listAudits denies unauthenticated", async () => {
    await expect(listAudits(UNAUTH)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("listAudits denies null role (module none)", async () => {
    await expect(
      listAudits({ userId: USER, role: null, vesselId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["vessel_user", "read_only"] as const)(
    "createAudit ForbiddenError for %s (audits:read)",
    async (role) => {
      await expect(
        createAudit(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          {
            vesselId: VESSEL_A,
            auditType: "ISSC",
            auditDate: "2026-06-01",
            findingsCount: 0,
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("createAudit vessel-scope ForbiddenError for management_user on another vessel", async () => {
    await expect(
      createAudit(
        { userId: USER, role: "management_user", vesselId: VESSEL_A },
        {
          vesselId: VESSEL_B,
          auditType: "ISSC",
          auditDate: "2026-06-01",
          findingsCount: 0,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(["vessel_user", "management_user"] as const)(
    "getAudit vessel-scope ForbiddenError for %s on another vessel",
    async (role) => {
      getDb.mockReturnValue({
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    audit: auditRow(VESSEL_B),
                    vesselName: "Beta",
                  },
                ],
              }),
            }),
          }),
        }),
      });

      await expect(
        getAudit({ userId: USER, role, vesselId: VESSEL_A }, AUDIT_ID),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "read_only"] as const)(
    "updateAudit ForbiddenError for %s (audits:read)",
    async (role) => {
      await expect(
        updateAudit(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          AUDIT_ID,
          { notes: "x" },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "read_only"] as const)(
    "deleteAudit ForbiddenError for %s (audits:read)",
    async (role) => {
      await expect(
        deleteAudit(
          {
            userId: USER,
            role,
            vesselId: role === "read_only" ? null : VESSEL_A,
          },
          AUDIT_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("listAudits happy path for admin", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: async () => [
                { audit: auditRow(VESSEL_A), vesselName: "Alpha" },
              ],
            }),
          }),
        }),
      }),
    });

    const rows = await listAudits(ADMIN);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(AUDIT_ID);
  });

  it("createAudit happy path for admin", async () => {
    const created = auditRow(VESSEL_A);
    getDb.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => [created],
        }),
      }),
    });

    const row = await createAudit(ADMIN, {
      vesselId: VESSEL_A,
      auditType: "ISSC",
      auditDate: "2026-06-01",
      findingsCount: 0,
    });
    expect(row.id).toBe(AUDIT_ID);
  });
});
