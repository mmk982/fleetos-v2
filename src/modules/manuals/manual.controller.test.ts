/**
 * Manuals controller — revision current-flag transaction + CRUD (mocked DB).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
}));

const removeStoredAttachmentFile = vi.fn(async (_path: string) => undefined);
vi.mock("@/lib/attachments/stream", () => ({
  removeStoredAttachmentFile: (filePath: string) =>
    removeStoredAttachmentFile(filePath),
}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

import {
  addManualRevision,
  createManualWithFirstRevision,
  updateManual,
} from "./manual.controller";

const VESSEL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MANUAL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CTX = { userId: "user-1", role: null };

const SAMPLE_FILE = {
  name: "manual.pdf",
  type: "application/pdf",
  size: 12,
  bytes: Buffer.from("%PDF-sample"),
};

function thenable<T>(value: T) {
  return {
    limit: async () => value,
    then: (
      onfulfilled?: (v: T) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => Promise.resolve(value).then(onfulfilled, onrejected),
  };
}

type AppliedOp =
  | "clear-current"
  | "insert-revision"
  | "insert-manual"
  | "touch-manual";

describe("manual.controller transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("addManualRevision clears prior current flags then inserts the new current row", async () => {
    const committed: AppliedOp[] = [];
    let inFlight: AppliedOp[] = [];

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => thenable([{ id: MANUAL_ID }]),
        }),
      }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        inFlight = [];
        try {
          const result = await fn({
            update: () => ({
              set: (patch: { isCurrentVersion?: boolean }) => ({
                where: async () => {
                  if (patch.isCurrentVersion === false) {
                    inFlight.push("clear-current");
                  }
                },
              }),
            }),
            insert: () => ({
              values: (vals: { isCurrentVersion?: boolean }) => {
                expect(vals.isCurrentVersion).toBe(true);
                return {
                  returning: async () => {
                    inFlight.push("insert-revision");
                    return [
                      {
                        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                        manualId: MANUAL_ID,
                        isCurrentVersion: true,
                        fileName: "manual.pdf",
                        filePath: "data/attachments/x.pdf",
                      },
                    ];
                  },
                };
              },
            }),
          });
          // touch manuals.updatedAt
          inFlight.push("touch-manual");
          committed.push(...inFlight);
          return result;
        } catch (error) {
          inFlight = [];
          throw error;
        }
      },
    });

    // Fix mock: manuals update is inside tx after insert
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => thenable([{ id: MANUAL_ID }]),
        }),
      }),
      transaction: async (fn: (tx: {
        update: (table?: unknown) => {
          set: (patch: Record<string, unknown>) => {
            where: () => Promise<void> | {
              returning: () => Promise<unknown[]>;
            };
          };
        };
        insert: () => {
          values: (vals: Record<string, unknown>) => {
            returning: () => Promise<unknown[]>;
          };
        };
      }) => Promise<unknown>) => {
        inFlight = [];
        try {
          const result = await fn({
            update: () => ({
              set: (patch: Record<string, unknown>) => ({
                where: async () => {
                  if (patch.isCurrentVersion === false) {
                    inFlight.push("clear-current");
                  } else if (patch.updatedAt) {
                    inFlight.push("touch-manual");
                  }
                },
              }),
            }),
            insert: () => ({
              values: (vals: Record<string, unknown>) => {
                expect(vals.isCurrentVersion).toBe(true);
                return {
                  returning: async () => {
                    inFlight.push("insert-revision");
                    return [
                      {
                        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                        manualId: MANUAL_ID,
                        isCurrentVersion: true,
                        fileName: "manual.pdf",
                        filePath: "data/attachments/x.pdf",
                        revisionNumber: "B",
                        revisionDate: null,
                        uploadedBy: CTX.userId,
                        uploadedAt: new Date(),
                      },
                    ];
                  },
                };
              },
            }),
          });
          committed.push(...inFlight);
          return result;
        } catch (error) {
          inFlight = [];
          throw error;
        }
      },
    });

    const row = await addManualRevision(
      CTX,
      MANUAL_ID,
      { revisionNumber: "B" },
      SAMPLE_FILE,
    );

    expect(committed[0]).toBe("clear-current");
    expect(committed).toContain("insert-revision");
    expect(row.isCurrentVersion).toBe(true);
  });

  it("rolls back when insert fails mid-transaction after clearing current", async () => {
    const committed: AppliedOp[] = [];
    let inFlight: AppliedOp[] = [];

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => thenable([{ id: MANUAL_ID }]),
        }),
      }),
      transaction: async (fn: (tx: {
        update: () => {
          set: (patch: Record<string, unknown>) => {
            where: () => Promise<void>;
          };
        };
        insert: () => {
          values: () => {
            returning: () => Promise<unknown[]>;
          };
        };
      }) => Promise<unknown>) => {
        inFlight = [];
        try {
          await fn({
            update: () => ({
              set: (patch: Record<string, unknown>) => ({
                where: async () => {
                  if (patch.isCurrentVersion === false) {
                    inFlight.push("clear-current");
                  }
                },
              }),
            }),
            insert: () => ({
              values: () => ({
                returning: async () => {
                  throw new Error("forced revision insert failure");
                },
              }),
            }),
          });
          committed.push(...inFlight);
        } catch (error) {
          inFlight = [];
          throw error;
        }
      },
    });

    await expect(
      addManualRevision(CTX, MANUAL_ID, { revisionNumber: "C" }, SAMPLE_FILE),
    ).rejects.toThrow("forced revision insert failure");

    expect(committed).toEqual([]);
    expect(removeStoredAttachmentFile).toHaveBeenCalled();
  });

  it("createManualWithFirstRevision inserts manual then revision in one transaction", async () => {
    const ops: AppliedOp[] = [];

    getDb.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle builder mock
      transaction: async (fn: (tx: any) => Promise<unknown>) => {
        let call = 0;
        return fn({
          insert: () => ({
            values: (vals: Record<string, unknown>) => {
              call += 1;
              if (call === 1) {
                ops.push("insert-manual");
                expect(vals).toMatchObject({
                  vesselId: VESSEL_ID,
                  title: "SMS Manual",
                });
                return {
                  returning: async () => [
                    {
                      id: MANUAL_ID,
                      vesselId: VESSEL_ID,
                      title: "SMS Manual",
                      manualType: null,
                      department: null,
                      notes: null,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    },
                  ],
                };
              }
              ops.push("insert-revision");
              expect(vals.isCurrentVersion).toBe(true);
              expect(vals.manualId).toBe(MANUAL_ID);
              return Promise.resolve();
            },
          }),
        });
      },
    });

    const row = await createManualWithFirstRevision(
      CTX,
      { vesselId: VESSEL_ID, title: "SMS Manual" },
      SAMPLE_FILE,
    );

    expect(ops).toEqual(["insert-manual", "insert-revision"]);
    expect(row.id).toBe(MANUAL_ID);
  });

  it("updateManual patches metadata only", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => thenable([{ id: MANUAL_ID }]),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          expect(patch).not.toHaveProperty("filePath");
          return {
            where: () => ({
              returning: async () => [
                {
                  id: MANUAL_ID,
                  vesselId: VESSEL_ID,
                  title: "Updated",
                  manualType: null,
                  department: "Deck",
                  notes: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ],
            }),
          };
        },
      }),
    });

    const row = await updateManual(CTX, MANUAL_ID, {
      title: "Updated",
      department: "Deck",
    });
    expect(row.title).toBe("Updated");
  });
});
