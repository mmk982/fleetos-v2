/**
 * scrubCrewMemberPii — transaction rollback + post-commit file deletes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const removeStoredAttachmentFile = vi.fn(async (_path: string) => undefined);
vi.mock("@/lib/attachments/stream", () => ({
  removeStoredAttachmentFile: (filePath: string) =>
    removeStoredAttachmentFile(filePath),
}));

const logError = vi.fn();
vi.mock("@/lib/logging", () => ({
  logError: (...args: [string, Record<string, unknown>?]) => logError(...args),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

const assertAuthenticatedAccess = vi.fn();
const assertModuleAccess = vi.fn();
const assertVesselScope = vi.fn();
vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: (
    ...args: [unknown, string?]
  ) => assertAuthenticatedAccess(...args),
  assertModuleAccess: (...args: unknown[]) => assertModuleAccess(...args),
  assertVesselScope: (...args: unknown[]) => assertVesselScope(...args),
}));
import {
  crewCertificateAttachments,
  crewCertificates,
  crewMembers,
} from "@/db/schema";
import { scrubCrewMemberPii } from "./scrub-pii";

const MEMBER_ID = "11111111-1111-1111-1111-111111111111";
const CERT_ID = "22222222-2222-2222-2222-222222222222";
const ATT_ID = "33333333-3333-3333-3333-333333333333";
const FILE_PATH = "data/attachments/passport.pdf";

type AppliedOp = "delete-atts" | "update-certs" | "update-member";

function thenableResult<T>(value: T) {
  return {
    limit: async () => value,
    then: (
      onfulfilled?: (v: T) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => Promise.resolve(value).then(onfulfilled, onrejected),
  };
}

function buildDb(options: { failMemberUpdate: boolean }) {
  /** Ops that would be visible if the transaction committed. */
  const committed: AppliedOp[] = [];
  /** Ops applied inside the open transaction (cleared on rollback). */
  let inFlight: AppliedOp[] = [];

  const selectQueue = [
    thenableResult([
      {
        id: MEMBER_ID,
        firstName: "Ada",
        lastName: "Lovelace",
        vesselId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
    ]),
    thenableResult([{ id: CERT_ID }]),
    thenableResult([
      {
        id: ATT_ID,
        crewCertificateId: CERT_ID,
        fileName: "passport.pdf",
        filePath: FILE_PATH,
        uploadedBy: null,
        uploadedAt: new Date(),
      },
    ]),
  ];

  const tx = {
    delete: (table: unknown) => ({
      where: async () => {
        expect(table).toBe(crewCertificateAttachments);
        inFlight.push("delete-atts");
      },
    }),
    update: (table: unknown) => ({
      set: () => ({
        where: async () => {
          if (table === crewCertificates) {
            inFlight.push("update-certs");
            return;
          }
          if (table === crewMembers) {
            if (options.failMemberUpdate) {
              throw new Error("forced member update failure");
            }
            inFlight.push("update-member");
            return;
          }
          throw new Error("unexpected update table");
        },
      }),
    }),
  };

  return {
    committed,
    db: {
      select: () => ({
        from: () => ({
          where: () => {
            const next = selectQueue.shift();
            if (!next) throw new Error("unexpected select");
            return next;
          },
        }),
      }),
      transaction: async (fn: (txClient: typeof tx) => Promise<void>) => {
        inFlight = [];
        try {
          await fn(tx);
          committed.push(...inFlight);
          inFlight = [];
        } catch (error) {
          // Rollback — discard in-flight writes.
          inFlight = [];
          throw error;
        }
      },
    },
  };
}

describe("scrubCrewMemberPii", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertAuthenticatedAccess.mockReset();
    assertModuleAccess.mockReset();
    assertVesselScope.mockReset();
  });

  it("rolls back certificate PII update when the member update fails mid-transaction", async () => {
    const { db, committed } = buildDb({ failMemberUpdate: true });
    getDb.mockReturnValue(db);

    await expect(
      scrubCrewMemberPii({ userId: "user-1", role: null, vesselId: null }, MEMBER_ID),
    ).rejects.toThrow("forced member update failure");

    expect(committed).not.toContain("update-certs");
    expect(committed).not.toContain("delete-atts");
    expect(committed).not.toContain("update-member");
    expect(committed).toEqual([]);
    expect(removeStoredAttachmentFile).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "CREW_SCRUB_PII_FAILED",
      expect.objectContaining({ crewMemberId: MEMBER_ID }),
    );
  });

  it("deletes on-disk files only after the DB transaction commits", async () => {
    const { db, committed } = buildDb({ failMemberUpdate: false });
    getDb.mockReturnValue(db);

    const result = await scrubCrewMemberPii(
      { userId: "user-1", role: null, vesselId: null },
      MEMBER_ID,
    );

    expect(committed).toEqual([
      "delete-atts",
      "update-certs",
      "update-member",
    ]);
    expect(removeStoredAttachmentFile).toHaveBeenCalledTimes(1);
    expect(removeStoredAttachmentFile).toHaveBeenCalledWith(FILE_PATH);
    expect(result).toEqual({ attachmentsRemoved: 1 });
  });
});
