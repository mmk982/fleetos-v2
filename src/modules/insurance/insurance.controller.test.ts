/**
 * Insurance controller — CRUD + cachedStatus recompute (mocked DB).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
  assertModuleAccess: vi.fn(),
  assertVesselScope: vi.fn(),
}));

vi.mock("@/lib/attachments/stream", () => ({
  removeStoredAttachmentFile: vi.fn(async () => undefined),
}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

import { deriveComplianceStatus } from "@/lib/expiry";
import { INSURANCE_REMINDER_RULE } from "./insurance.model";
import {
  createInsurancePolicy,
  getInsurancePolicyById,
  listInsurancePolicies,
  updateInsurancePolicy,
} from "./insurance.controller";

const VESSEL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const POLICY_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CTX = { userId: "user-1", role: null, vesselId: null };

function expectedStatus(expiryDate: string | null) {
  return deriveComplianceStatus({
    rule: INSURANCE_REMINDER_RULE,
    expiryDate,
  }).status;
}

function thenable<T>(value: T) {
  return {
    limit: async () => value,
    orderBy: async () => value,
    then: (
      onfulfilled?: (v: T) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => Promise.resolve(value).then(onfulfilled, onrejected),
  };
}

/** `.set(patch).where()` optionally followed by `.returning()`. */
function updateChain(
  onSet: (patch: Record<string, unknown>) => void,
  returningRow: () => unknown,
) {
  return {
    set: (patch: Record<string, unknown>) => {
      onSet(patch);
      const whereResult = {
        returning: async () => [returningRow()],
        then: (
          onfulfilled?: (v: unknown) => unknown,
          onrejected?: (e: unknown) => unknown,
        ) => Promise.resolve(undefined).then(onfulfilled, onrejected),
      };
      return {
        where: () => whereResult,
      };
    },
  };
}

describe("insurance.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listInsurancePolicies derives live compliance with the fixed 30d rule", async () => {
    const expiryDate = "2026-07-01";
    const policy = {
      id: POLICY_ID,
      vesselId: VESSEL_ID,
      policyType: "pi" as const,
      provider: null,
      policyNumber: null,
      coverageAmount: null,
      currency: null,
      startDate: null,
      expiryDate,
      cachedStatus: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: async () => [{ policy, vesselName: "GLIMLIT" }],
            }),
            orderBy: async () => [{ policy, vesselName: "GLIMLIT" }],
          }),
        }),
      }),
    });

    const rows = await listInsurancePolicies(CTX);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.compliance.status).toBe(expectedStatus(expiryDate));
    expect(rows[0]?.vesselName).toBe("GLIMLIT");
  });

  it("createInsurancePolicy writes cachedStatus from the engine", async () => {
    const expiryDate = "2026-07-01";
    const inserted = {
      id: POLICY_ID,
      vesselId: VESSEL_ID,
      policyType: "hm" as const,
      provider: null,
      policyNumber: null,
      coverageAmount: null,
      currency: null,
      startDate: "2026-01-01",
      expiryDate,
      cachedStatus: null as string | null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let cachedWritten: string | null = null;

    getDb.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => [inserted],
        }),
      }),
      update: () =>
        updateChain((patch) => {
          if (typeof patch.cachedStatus === "string") {
            cachedWritten = patch.cachedStatus;
            inserted.cachedStatus = patch.cachedStatus;
          }
        }, () => inserted),
      select: () => ({
        from: () => ({
          where: () =>
            thenable([{ ...inserted, cachedStatus: cachedWritten }]),
        }),
      }),
    });

    const row = await createInsurancePolicy(CTX, {
      vesselId: VESSEL_ID,
      policyType: "hm",
      startDate: "2026-01-01",
      expiryDate,
    });

    expect(cachedWritten).toBe(expectedStatus(expiryDate));
    expect(row.cachedStatus).toBe(expectedStatus(expiryDate));
  });

  it("updateInsurancePolicy recomputes cachedStatus on write", async () => {
    const newExpiry = "2099-12-31";
    const existing = {
      id: POLICY_ID,
      vesselId: VESSEL_ID,
      policyType: "pi" as const,
      provider: null,
      policyNumber: null,
      coverageAmount: null,
      currency: null,
      startDate: null,
      expiryDate: "2020-01-01",
      cachedStatus: "expired" as string | null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let current = { ...existing };
    let cachedWritten: string | null = null;
    let selectN = 0;

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => {
            selectN += 1;
            // 1) existence check, 2) post-refresh read
            return thenable([{ ...current, cachedStatus: cachedWritten ?? current.cachedStatus }]);
          },
        }),
      }),
      update: () =>
        updateChain(
          (patch) => {
            current = { ...current, ...patch } as typeof current;
            if (typeof patch.cachedStatus === "string") {
              cachedWritten = patch.cachedStatus;
            }
          },
          () => current,
        ),
    });

    const row = await updateInsurancePolicy(CTX, POLICY_ID, {
      expiryDate: newExpiry,
    });

    expect(cachedWritten).toBe(expectedStatus(newExpiry));
    expect(row.cachedStatus).toBe(expectedStatus(newExpiry));
    expect(selectN).toBeGreaterThanOrEqual(2);
  });

  it("getInsurancePolicyById returns undefined when missing", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => thenable([]),
          }),
        }),
      }),
    });

    await expect(getInsurancePolicyById(CTX, POLICY_ID)).resolves.toBeUndefined();
  });
});
