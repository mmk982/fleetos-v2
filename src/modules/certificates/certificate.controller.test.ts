/**
 * Certificate parent-link rules (parentCertificateId).
 *
 * A sub-item must share the parent's vessel, cannot parent itself, and
 * cannot nest under another sub-item (one level only).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
  assertModuleAccess: vi.fn(),
  assertVesselScope: vi.fn(),
  requireScopedVesselId: vi.fn(() => undefined),
}));

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
  CertificateConflictError,
  createCertificate,
  updateCertificate,
} from "./certificate.controller";

const VESSEL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const VESSEL_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TYPE_ID = "11111111-1111-1111-1111-111111111111";
const PARENT_ID = "22222222-2222-2222-2222-222222222222";
const CHILD_ID = "33333333-3333-3333-3333-333333333333";
const GRANDCHILD_ID = "44444444-4444-4444-4444-444444444444";
const CTX = { userId: "user-1", role: "admin", vesselId: null };

const TYPE_ROW = {
  id: TYPE_ID,
  authority: "radio" as const,
  name: "EPIRB Battery",
  ruleKind: "expiry_offset" as const,
  offsetDays: 30,
  isCustom: false,
  createdAt: new Date(),
};

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

function baseCert(overrides: Record<string, unknown> = {}) {
  return {
    id: PARENT_ID,
    vesselId: VESSEL_A,
    certificateTypeId: TYPE_ID,
    certificateNumber: null,
    issuingAuthorityId: null,
    parentCertificateId: null,
    issueDate: null,
    expiryDate: "2027-01-01",
    windowOpenDate: null,
    windowCloseDate: null,
    linkedToDryDock: false,
    customOffsetDays: null,
    lifecycleStatus: "active",
    cachedStatus: null,
    remarks: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function parentDetail(overrides: Record<string, unknown> = {}) {
  const certificate = baseCert(overrides);
  return {
    ...certificate,
    vesselName: "GLIMLIT",
    typeName: "Radio Certificate",
    authority: "radio",
    ruleKind: "expiry_offset",
    typeOffsetDays: 30,
    issuingAuthorityName: null,
    compliance: { status: "valid", daysRemaining: 400 },
    events: [],
    attachments: [],
    certificateType: TYPE_ROW,
    issuingAuthority: null,
    vessel: { id: certificate.vesselId, name: "GLIMLIT" },
  };
}

describe("certificate parentCertificateId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a sub-item when the parent is on the same vessel", async () => {
    const inserted = baseCert({ id: CHILD_ID, parentCertificateId: PARENT_ID });
    const captured: Record<string, unknown>[] = [];

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [TYPE_ROW],
          }),
          innerJoin: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: () => ({
                  limit: async () => [
                    {
                      certificate: baseCert(),
                      vessel: { id: VESSEL_A, name: "GLIMLIT" },
                      certificateType: TYPE_ROW,
                      issuingAuthority: null,
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (payload: Record<string, unknown>) => {
          captured.push(payload);
          return {
            returning: async () => [inserted],
          };
        },
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(undefined),
        }),
      }),
    });

    const row = await createCertificate(CTX, {
      vesselId: VESSEL_A,
      certificateTypeId: TYPE_ID,
      parentCertificateId: PARENT_ID,
      linkedToDryDock: false,
      lifecycleStatus: "active",
    });

    expect(captured[0]?.parentCertificateId).toBe(PARENT_ID);
    expect(row.parentCertificateId).toBe(PARENT_ID);
  });

  it("rejects a parentCertificateId on a different vessel", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [TYPE_ROW],
          }),
          innerJoin: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: () => ({
                  limit: async () => [
                    {
                      certificate: baseCert({ vesselId: VESSEL_B }),
                      vessel: { id: VESSEL_B, name: "OTHER" },
                      certificateType: TYPE_ROW,
                      issuingAuthority: null,
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      }),
    });

    await expect(
      createCertificate(CTX, {
        vesselId: VESSEL_A,
        certificateTypeId: TYPE_ID,
        parentCertificateId: PARENT_ID,
        linkedToDryDock: false,
        lifecycleStatus: "active",
      }),
    ).rejects.toBeInstanceOf(CertificateConflictError);
  });

  it("rejects a parent that is itself a sub-item", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [TYPE_ROW],
          }),
          innerJoin: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: () => ({
                  limit: async () => [
                    {
                      certificate: baseCert({
                        id: PARENT_ID,
                        parentCertificateId: GRANDCHILD_ID,
                      }),
                      vessel: { id: VESSEL_A, name: "GLIMLIT" },
                      certificateType: TYPE_ROW,
                      issuingAuthority: null,
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      }),
    });

    await expect(
      createCertificate(CTX, {
        vesselId: VESSEL_A,
        certificateTypeId: TYPE_ID,
        parentCertificateId: PARENT_ID,
        linkedToDryDock: false,
        lifecycleStatus: "active",
      }),
    ).rejects.toBeInstanceOf(CertificateConflictError);
  });

  it("rejects self-parenting on update", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => thenable([baseCert({ id: PARENT_ID })]),
        }),
      }),
    });

    await expect(
      updateCertificate(CTX, PARENT_ID, { parentCertificateId: PARENT_ID }),
    ).rejects.toBeInstanceOf(CertificateConflictError);
  });
});
