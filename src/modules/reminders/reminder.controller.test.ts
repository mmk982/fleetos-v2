/**
 * Reminders controller — CRUD + dismiss/complete (mocked DB).
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
  completeReminder,
  createReminder,
  dismissReminder,
  listReminders,
  updateReminder,
} from "./reminder.controller";

const REMINDER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const VESSEL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CTX = { userId: "user-1", role: null };

function thenable<T>(value: T) {
  return {
    orderBy: async () => value,
    then: (
      onfulfilled?: (v: T) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => Promise.resolve(value).then(onfulfilled, onrejected),
  };
}

describe("reminder.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listReminders left-joins vesselName (null when fleet-wide)", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () =>
              thenable([
                {
                  reminder: {
                    id: REMINDER_ID,
                    vesselId: null,
                    title: "Fleet note",
                    type: "custom",
                    relatedItemKind: null,
                    relatedItemId: null,
                    priority: "medium",
                    reminderDate: "2026-07-01",
                    status: "pending",
                    notes: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                  vesselName: null,
                },
              ]),
          }),
        }),
      }),
    });

    const rows = await listReminders(CTX);
    expect(rows[0]?.vesselName).toBeNull();
    expect(rows[0]?.title).toBe("Fleet note");
  });

  it("createReminder inserts pending with defaults", async () => {
    getDb.mockReturnValue({
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          expect(vals).toMatchObject({
            title: "Check cert",
            type: "certificate",
            priority: "medium",
            status: "pending",
            vesselId: VESSEL_ID,
          });
          return {
            returning: async () => [
              {
                id: REMINDER_ID,
                ...vals,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          };
        },
      }),
    });

    const row = await createReminder(CTX, {
      title: "Check cert",
      type: "certificate",
      priority: "medium",
      reminderDate: "2026-07-01",
      vesselId: VESSEL_ID,
    });
    expect(row.id).toBe(REMINDER_ID);
  });

  it("dismissReminder sets status dismissed", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: REMINDER_ID }],
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          expect(patch.status).toBe("dismissed");
          return {
            where: () => ({
              returning: async () => [
                {
                  id: REMINDER_ID,
                  status: "dismissed",
                  title: "x",
                  type: "custom",
                  priority: "low",
                  reminderDate: "2026-01-01",
                  vesselId: null,
                  relatedItemKind: null,
                  relatedItemId: null,
                  notes: null,
                  createdAt: new Date(),
                  updatedAt: patch.updatedAt,
                },
              ],
            }),
          };
        },
      }),
    });

    const row = await dismissReminder(CTX, REMINDER_ID);
    expect(row.status).toBe("dismissed");
  });

  it("completeReminder sets status done", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: REMINDER_ID }],
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          expect(patch.status).toBe("done");
          return {
            where: () => ({
              returning: async () => [
                {
                  id: REMINDER_ID,
                  status: "done",
                  title: "x",
                  type: "custom",
                  priority: "low",
                  reminderDate: "2026-01-01",
                  vesselId: null,
                  relatedItemKind: null,
                  relatedItemId: null,
                  notes: null,
                  createdAt: new Date(),
                  updatedAt: patch.updatedAt,
                },
              ],
            }),
          };
        },
      }),
    });

    const row = await completeReminder(CTX, REMINDER_ID);
    expect(row.status).toBe("done");
  });

  it("updateReminder patches fields", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: REMINDER_ID }],
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          expect(patch.title).toBe("Updated");
          return {
            where: () => ({
              returning: async () => [
                {
                  id: REMINDER_ID,
                  title: "Updated",
                  status: "pending",
                  type: "custom",
                  priority: "high",
                  reminderDate: "2026-01-01",
                  vesselId: null,
                  relatedItemKind: null,
                  relatedItemId: null,
                  notes: null,
                  createdAt: new Date(),
                  updatedAt: patch.updatedAt,
                },
              ],
            }),
          };
        },
      }),
    });

    const row = await updateReminder(CTX, REMINDER_ID, {
      title: "Updated",
      priority: "high",
    });
    expect(row.title).toBe("Updated");
  });
});
