/**
 * Recipient visibility for notification fan-out (no DB).
 */
import { describe, expect, it } from "vitest";
import {
  canReceiveNotification,
  isDuplicateNotification,
  LEGACY_SUPPRESS_MS,
} from "./notifications.model";

describe("isDuplicateNotification", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("treats the same cycle as a duplicate", () => {
    expect(
      isDuplicateNotification(
        { cycleKey: "2026-11-30", createdAt: daysAgo(200) },
        "2026-11-30",
        now,
      ),
    ).toBe(true);
  });

  it("notifies again for a new cycle (renewed certificate)", () => {
    expect(
      isDuplicateNotification(
        { cycleKey: "2026-11-30", createdAt: daysAgo(5) },
        "2027-11-30",
        now,
      ),
    ).toBe(false);
  });

  it("lets a recent legacy row suppress, but not an old one", () => {
    const recent = { cycleKey: "", createdAt: daysAgo(10) };
    const old = {
      cycleKey: "",
      createdAt: new Date(now.getTime() - LEGACY_SUPPRESS_MS - 1000),
    };
    expect(isDuplicateNotification(recent, "2026-11-30", now)).toBe(true);
    expect(isDuplicateNotification(old, "2026-11-30", now)).toBe(false);
  });
});

const VESSEL_A = "11111111-1111-4111-8111-111111111111";
const VESSEL_B = "22222222-2222-4222-8222-222222222222";

describe("canReceiveNotification", () => {
  it("delivers any vessel (and vessel-less items) to office roles", () => {
    for (const role of ["admin", "superintendent"]) {
      const user = { role, vesselId: null };
      expect(canReceiveNotification(user, VESSEL_A)).toBe(true);
      expect(canReceiveNotification(user, null)).toBe(true);
    }
  });

  it("delivers only the own vessel to vessel-scoped roles", () => {
    for (const role of ["vessel_user", "management_user"]) {
      const user = { role, vesselId: VESSEL_A };
      expect(canReceiveNotification(user, VESSEL_A)).toBe(true);
      expect(canReceiveNotification(user, VESSEL_B)).toBe(false);
      expect(canReceiveNotification(user, null)).toBe(false);
    }
  });

  it("fails closed for a vessel-scoped role without an assigned vessel", () => {
    const user = { role: "vessel_user", vesselId: null };
    expect(canReceiveNotification(user, VESSEL_A)).toBe(false);
    expect(canReceiveNotification(user, null)).toBe(false);
  });

  it("denies a role with no alerts access", () => {
    expect(canReceiveNotification({ role: null, vesselId: null }, VESSEL_A)).toBe(
      false,
    );
  });
});
