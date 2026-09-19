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

function parentJoinRow(overrides: Record<string, unknown> = {}) {
  const certificate = baseCert(overrides);
  return {
    certificate,
    vessel: { id: certificate.vesselId, name: "GLIMLIT" },
    certificateType: TYPE_ROW,
    issuingAuthority: null,
  };
}

function selectChain(opts: {
  parentJoin: unknown;
  inserted?: unknown;
}) {
  let simpleLimitCalls = 0;
  const node = (joined: boolean): Record<string, unknown> => ({
    from: () => node(joined),
    innerJoin: () => node(true),
    leftJoin: () => node(joined),
    where: () => node(joined),
    groupBy: () => node(joined),
    orderBy: async () => [],
    limit: async () => {
      if (joined) {
        return [opts.parentJoin];
      }
      simpleLimitCalls += 1;
      if (simpleLimitCalls === 1) {
        return [TYPE_ROW];
      }
      return opts.inserted ? [opts.inserted] : [TYPE_ROW];
    },
    then: (
      onfulfilled?: (v: unknown) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => Promise.resolve([]).then(onfulfilled, onrejected),
  });
  return () => node(false);
}

describe("certificate parentCertificateId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a sub-item when the parent is on the same vessel", async () => {
    const inserted = baseCert({ id: CHILD_ID, parentCertificateId: PARENT_ID });
    const captured: Record<string, unknown>[] = [];

    getDb.mockReturnValue({
      select: selectChain({
        parentJoin: parentJoinRow(),
        inserted,
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
      select: selectChain({
        parentJoin: parentJoinRow({ vesselId: VESSEL_B }),
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
      select: selectChain({
        parentJoin: parentJoinRow({
          id: PARENT_ID,
          parentCertificateId: GRANDCHILD_ID,
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

  it("rejects moving a sub-item to another vessel while the parent link is untouched", async () => {
    getDb.mockReturnValue(
      updateDbMock({
        existing: baseCert({
          id: CHILD_ID,
          parentCertificateId: PARENT_ID,
        }),
        childCount: 0,
      }),
    );

    await expect(
      updateCertificate(CTX, CHILD_ID, { vesselId: VESSEL_B }),
    ).rejects.toBeInstanceOf(CertificateConflictError);
  });

  it("allows moving a sub-item when the same call clears the parent link", async () => {
    const existing = baseCert({
      id: CHILD_ID,
      parentCertificateId: PARENT_ID,
    });
    const updated = baseCert({
      id: CHILD_ID,
      vesselId: VESSEL_B,
      parentCertificateId: null,
    });
    const captured: Record<string, unknown>[] = [];

    getDb.mockReturnValue(
      updateDbMock({
        existing,
        updated,
        childCount: 0,
        captured,
      }),
    );

    const row = await updateCertificate(CTX, CHILD_ID, {
      vesselId: VESSEL_B,
      parentCertificateId: null,
    });

    expect(captured[0]?.vesselId).toBe(VESSEL_B);
    expect(captured[0]?.parentCertificateId).toBeNull();
    expect(row.vesselId).toBe(VESSEL_B);
    expect(row.parentCertificateId).toBeNull();
  });

  it("rejects moving a parent certificate that still has sub-items", async () => {
    getDb.mockReturnValue(
      updateDbMock({
        existing: baseCert({ id: PARENT_ID, parentCertificateId: null }),
        childCount: 2,
      }),
    );

    await expect(
      updateCertificate(CTX, PARENT_ID, { vesselId: VESSEL_B }),
    ).rejects.toBeInstanceOf(CertificateConflictError);
  });

  it("allows moving a certificate with no parent link and no children", async () => {
    const existing = baseCert({ id: PARENT_ID, parentCertificateId: null });
    const updated = baseCert({
      id: PARENT_ID,
      vesselId: VESSEL_B,
      parentCertificateId: null,
    });
    const captured: Record<string, unknown>[] = [];

    getDb.mockReturnValue(
      updateDbMock({
        existing,
        updated,
        childCount: 0,
        captured,
      }),
    );

    const row = await updateCertificate(CTX, PARENT_ID, { vesselId: VESSEL_B });

    expect(captured[0]?.vesselId).toBe(VESSEL_B);
    expect(row.vesselId).toBe(VESSEL_B);
  });
});

function updateDbMock(opts: {
  existing: ReturnType<typeof baseCert>;
  updated?: ReturnType<typeof baseCert>;
  childCount?: number;
  captured?: Record<string, unknown>[];
}) {
  const updated = opts.updated ?? {
    ...opts.existing,
    vesselId: VESSEL_B,
  };
  let limitCalls = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            limitCalls += 1;
            if (limitCalls === 1) {
              return [opts.existing];
            }
            if (limitCalls === 2) {
              return [TYPE_ROW];
            }
            return [updated];
          },
          then: (
            onfulfilled?: (v: unknown) => unknown,
            onrejected?: (e: unknown) => unknown,
          ) =>
            Promise.resolve([{ n: opts.childCount ?? 0 }]).then(
              onfulfilled,
              onrejected,
            ),
        }),
      }),
    }),
    update: () => ({
      set: (payload: Record<string, unknown>) => {
        opts.captured?.push(payload);
        return {
          where: () => ({
            returning: async () => [updated],
            then: (
              onfulfilled?: (v: unknown) => unknown,
              onrejected?: (e: unknown) => unknown,
            ) => Promise.resolve(undefined).then(onfulfilled, onrejected),
          }),
        };
      },
    }),
  };
}
