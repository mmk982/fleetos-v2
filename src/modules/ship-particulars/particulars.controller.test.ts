/**
 * Particulars controller — isCurrent transaction behavior (mocked DB).
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

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

import {
  createParticulars,
  updateParticulars,
} from "./particulars.controller";

const VESSEL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROW_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OLD_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CTX = { userId: "user-1", role: null, vesselId: null };

describe("particulars.controller isCurrent transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createParticulars with isCurrent flips siblings then inserts", async () => {
    const ops: string[] = [];

    getDb.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle tx mock
      transaction: async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          update: () => ({
            set: (patch: Record<string, unknown>) => {
              expect(patch.isCurrent).toBe(false);
              ops.push("flip-siblings");
              return {
                where: () => Promise.resolve(),
              };
            },
          }),
          insert: () => ({
            values: (vals: Record<string, unknown>) => {
              ops.push("insert");
              expect(vals.isCurrent).toBe(true);
              expect(vals.vesselId).toBe(VESSEL_ID);
              return {
                returning: async () => [
                  {
                    id: ROW_ID,
                    vesselId: VESSEL_ID,
                    isCurrent: true,
                    classSociety: null,
                    lengthOverall: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                ],
              };
            },
          }),
        }),
    });

    const row = await createParticulars(CTX, {
      vesselId: VESSEL_ID,
      isCurrent: true,
    });
    expect(ops).toEqual(["flip-siblings", "insert"]);
    expect(row.id).toBe(ROW_ID);
  });

  it("updateParticulars with isCurrent:true flips siblings", async () => {
    const ops: string[] = [];

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: OLD_ID,
                vesselId: VESSEL_ID,
                isCurrent: false,
              },
            ],
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle tx mock
      transaction: async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          update: () => ({
            set: (patch: Record<string, unknown>) => {
              if (patch.isCurrent === false && !("owner" in patch)) {
                ops.push("flip-siblings");
                return { where: () => Promise.resolve() };
              }
              ops.push("set-current");
              expect(patch.isCurrent).toBe(true);
              return {
                where: () => ({
                  returning: async () => [
                    {
                      id: OLD_ID,
                      vesselId: VESSEL_ID,
                      isCurrent: true,
                      owner: "Acme",
                    },
                  ],
                }),
              };
            },
          }),
        }),
    });

    const row = await updateParticulars(CTX, OLD_ID, {
      isCurrent: true,
      owner: "Acme",
    });
    expect(ops).toEqual(["flip-siblings", "set-current"]);
    expect(row.isCurrent).toBe(true);
  });

  it("plain update without isCurrent does not open a transaction", async () => {
    const transaction = vi.fn();
    getDb.mockReturnValue({
      transaction,
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: ROW_ID,
                vesselId: VESSEL_ID,
                isCurrent: true,
              },
            ],
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          expect(patch.isCurrent).toBeUndefined();
          expect(patch.owner).toBe("Beta");
          return {
            where: () => ({
              returning: async () => [
                {
                  id: ROW_ID,
                  vesselId: VESSEL_ID,
                  isCurrent: true,
                  owner: "Beta",
                },
              ],
            }),
          };
        },
      }),
    });

    const row = await updateParticulars(CTX, ROW_ID, { owner: "Beta" });
    expect(transaction).not.toHaveBeenCalled();
    expect(row.owner).toBe("Beta");
  });
});
