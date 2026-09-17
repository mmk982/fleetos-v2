/**
 * Vessel notes controller — create/list/delete (mocked DB).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

import {
  createVesselNote,
  deleteVesselNote,
  listVesselNotes,
  VesselNoteNotFoundError,
} from "./vessel-notes.controller";

const VESSEL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const NOTE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CTX = { userId: "user-1", role: null, vesselId: null };

function thenable<T>(value: T) {
  return {
    orderBy: async () => value,
    then: (
      onfulfilled?: (v: T) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => Promise.resolve(value).then(onfulfilled, onrejected),
  };
}

describe("vessel-notes.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listVesselNotes returns newest-first rows", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () =>
              thenable([
                {
                  note: {
                    id: NOTE_ID,
                    vesselId: VESSEL_ID,
                    body: "Hello",
                    authorId: CTX.userId,
                    createdAt: new Date(),
                  },
                  authorName: "Ada",
                },
              ]),
          }),
        }),
      }),
    });

    const rows = await listVesselNotes(CTX, VESSEL_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.body).toBe("Hello");
    expect(rows[0]?.authorName).toBe("Ada");
  });

  it("createVesselNote inserts with authorId", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: VESSEL_ID }],
          }),
        }),
      }),
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          expect(vals).toMatchObject({
            vesselId: VESSEL_ID,
            body: "Note body",
            authorId: CTX.userId,
          });
          return {
            returning: async () => [
              {
                id: NOTE_ID,
                vesselId: VESSEL_ID,
                body: "Note body",
                authorId: CTX.userId,
                createdAt: new Date(),
              },
            ],
          };
        },
      }),
    });

    const row = await createVesselNote(CTX, VESSEL_ID, "Note body");
    expect(row.id).toBe(NOTE_ID);
  });

  it("deleteVesselNote throws when missing", async () => {
    getDb.mockReturnValue({
      delete: () => ({
        where: () => ({
          returning: async () => [],
        }),
      }),
    });

    await expect(deleteVesselNote(CTX, NOTE_ID)).rejects.toBeInstanceOf(
      VesselNoteNotFoundError,
    );
  });

  it("deleteVesselNote returns vesselId when deleted", async () => {
    getDb.mockReturnValue({
      delete: () => ({
        where: () => ({
          returning: async () => [{ id: NOTE_ID, vesselId: VESSEL_ID }],
        }),
      }),
    });

    await expect(deleteVesselNote(CTX, NOTE_ID)).resolves.toEqual({
      vesselId: VESSEL_ID,
    });
  });
});
