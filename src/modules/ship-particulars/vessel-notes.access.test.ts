/**
 * Vessel notes write gate — real assertModuleAccess (particulars:write).
 * vessel_user / management_user are particulars:read only.
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
  withDb: async (_ctx: unknown, fn: (db: unknown) => unknown) =>
    fn(undefined as unknown),
  withSystemDb: async (_reason: unknown, fn: (db: unknown) => unknown) =>
    fn(getDb()),
}));

import { ForbiddenError } from "@/lib/auth/access";
import { createVesselNote, deleteVesselNote } from "./vessel-notes.controller";

const VESSEL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const NOTE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("vessel-notes write forbidden for scoped read roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["vessel_user", "management_user"] as const)(
    "createVesselNote ForbiddenError for %s",
    async (role) => {
      await expect(
        createVesselNote(
          { userId: USER, role, vesselId: VESSEL_A },
          VESSEL_A,
          "note body",
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it.each(["vessel_user", "management_user"] as const)(
    "deleteVesselNote ForbiddenError for %s",
    async (role) => {
      getDb.mockReturnValue({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                { id: NOTE_ID, vesselId: VESSEL_A },
              ],
            }),
          }),
        }),
      });
      await expect(
        deleteVesselNote(
          { userId: USER, role, vesselId: VESSEL_A },
          NOTE_ID,
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    },
  );
});
