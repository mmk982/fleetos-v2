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

import { MissingVesselAssignmentError } from "@/lib/auth/access";
import { syncNotifications } from "./notifications.controller";

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
