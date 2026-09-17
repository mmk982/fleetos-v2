/**
 * getCriticalDays / setCriticalDays — mocked DB.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
  assertModuleAccess: vi.fn(),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

import { DEFAULT_CRITICAL_DAYS } from "@/lib/expiry";
import {
  CRITICAL_DAYS_KEY,
  getCriticalDays,
  setCriticalDays,
} from "./critical-days";

const CTX = { userId: "user-1", role: "admin", vesselId: null };

describe("getCriticalDays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to DEFAULT_CRITICAL_DAYS when row missing", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    });
    expect(await getCriticalDays()).toBe(DEFAULT_CRITICAL_DAYS);
  });

  it("falls back when value is not a positive integer", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ value: "0" }],
          }),
        }),
      }),
    });
    expect(await getCriticalDays()).toBe(DEFAULT_CRITICAL_DAYS);
  });

  it("returns stored positive integer", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ value: "14" }],
          }),
        }),
      }),
    });
    expect(await getCriticalDays()).toBe(14);
  });
});

describe("setCriticalDays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-positive values", async () => {
    await expect(setCriticalDays(CTX, 0)).rejects.toThrow(/positive integer/i);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("upserts under criticalDays key", async () => {
    const onConflictDoUpdate = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    getDb.mockReturnValue({ insert });

    await setCriticalDays(CTX, 21);

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        key: CRITICAL_DAYS_KEY,
        value: "21",
      }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });
});
