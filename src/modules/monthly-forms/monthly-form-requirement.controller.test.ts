/**
 * Monthly form requirements controller — CRUD + unique conflict (mocked DB).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
  assertVesselScope: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {
    readonly code = "FORBIDDEN" as const;
    constructor(message = "Forbidden") {
      super(message);
      this.name = "ForbiddenError";
    }
  },
}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

import {
  createMonthlyFormRequirement,
  deleteMonthlyFormRequirement,
  MonthlyFormRequirementConflictError,
  updateMonthlyFormRequirement,
} from "./monthly-form-requirement.controller";

const VESSEL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEMPLATE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REQ_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CTX = { userId: "user-1", role: "admin", vesselId: null };

describe("monthly-form-requirement.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createMonthlyFormRequirement inserts a row", async () => {
    getDb.mockReturnValue({
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          expect(vals).toMatchObject({
            vesselId: VESSEL_ID,
            ismTemplateId: TEMPLATE_ID,
            frequency: "monthly",
            activeStatus: true,
          });
          return {
            returning: async () => [
              {
                id: REQ_ID,
                vesselId: VESSEL_ID,
                ismTemplateId: TEMPLATE_ID,
                frequency: "monthly",
                activeStatus: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          };
        },
      }),
    });

    const row = await createMonthlyFormRequirement(CTX, {
      vesselId: VESSEL_ID,
      ismTemplateId: TEMPLATE_ID,
      frequency: "monthly",
      activeStatus: true,
    });
    expect(row.id).toBe(REQ_ID);
  });

  it("createMonthlyFormRequirement maps unique violations to conflict", async () => {
    getDb.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => {
            const err = Object.assign(new Error("unique"), { code: "23505" });
            throw err;
          },
        }),
      }),
    });

    await expect(
      createMonthlyFormRequirement(CTX, {
        vesselId: VESSEL_ID,
        ismTemplateId: TEMPLATE_ID,
        frequency: "monthly",
        activeStatus: true,
      }),
    ).rejects.toBeInstanceOf(MonthlyFormRequirementConflictError);
  });

  it("updateMonthlyFormRequirement patches fields", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: REQ_ID }],
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          expect(patch.activeStatus).toBe(false);
          return {
            where: () => ({
              returning: async () => [
                {
                  id: REQ_ID,
                  vesselId: VESSEL_ID,
                  ismTemplateId: TEMPLATE_ID,
                  frequency: "quarterly",
                  activeStatus: false,
                  createdAt: new Date(),
                  updatedAt: patch.updatedAt,
                },
              ],
            }),
          };
        },
      }),
    });

    const row = await updateMonthlyFormRequirement(CTX, REQ_ID, {
      activeStatus: false,
      frequency: "quarterly",
    });
    expect(row.activeStatus).toBe(false);
  });

  it("deleteMonthlyFormRequirement removes the row", async () => {
    getDb.mockReturnValue({
      delete: () => ({
        where: () => ({
          returning: async () => [{ id: REQ_ID }],
        }),
      }),
    });

    await expect(
      deleteMonthlyFormRequirement(CTX, REQ_ID),
    ).resolves.toBeUndefined();
  });
});
