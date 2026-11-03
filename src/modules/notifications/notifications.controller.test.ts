/**
 * syncNotifications edge cases (no-vessel skip must not log ERROR).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAlerts = vi.fn();
const logError = vi.fn();

vi.mock("@/modules/alerts/alerts.controller", () => ({
  getAlerts: (...args: unknown[]) => getAlerts(...args),
}));

vi.mock("@/lib/logging", () => ({
  logError: (...args: unknown[]) => logError(...args),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
  withDb: async (_ctx: unknown, fn: (db: unknown) => Promise<unknown>) =>
    fn({}),
  withSystemDb: async (_label: string, fn: () => Promise<unknown>) => fn(),
}));

import { ForbiddenError, MissingVesselAssignmentError } from "@/lib/auth/access";
import {
  markAllNotificationsRead,
  syncNotifications,
} from "./notifications.controller";
import { getDb } from "@/db/client";

describe("syncNotifications", () => {
  beforeEach(() => {
    getAlerts.mockReset();
    logError.mockReset();
  });

  it("skips with info (not ERROR) when caller has no vessel assignment", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    getAlerts.mockRejectedValue(new MissingVesselAssignmentError());

    await syncNotifications({
      userId: "user-1",
      role: "vessel_user",
      vesselId: null,
    });

    expect(logError).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0]?.[0] ?? "")).toContain(
      "NOTIFICATION_SYNC_SKIPPED_NO_VESSEL",
    );
    info.mockRestore();
  });

  it("still logs NOTIFICATION_SYNC_FAILED for unexpected errors", async () => {
    getAlerts.mockRejectedValue(new Error("boom"));

    await syncNotifications({
      userId: "user-1",
      role: "admin",
      vesselId: null,
    });

    expect(logError).toHaveBeenCalledWith(
      "NOTIFICATION_SYNC_FAILED",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});

describe("markAllNotificationsRead", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockReset();
  });

  it("updates only the session user's unread rows", async () => {
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    vi.mocked(getDb).mockReturnValue({ update } as never);

    await markAllNotificationsRead({
      userId: "user-1",
      role: "admin",
      vesselId: null,
    });

    expect(update).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it("rejects unauthenticated context before updating", async () => {
    await expect(
      markAllNotificationsRead({
        userId: "",
        role: "admin",
        vesselId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
