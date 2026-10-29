/**
 * getNavBadges — empty badges when vessel-scoped caller has no vessel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAlerts = vi.fn();
const getOpenDeficienciesCount = vi.fn();
const listMonthlyForms = vi.fn();

vi.mock("@/modules/alerts/alerts.controller", () => ({
  getAlerts: (...args: unknown[]) => getAlerts(...args),
}));
vi.mock("@/modules/deficiencies/deficiency.controller", () => ({
  getOpenDeficienciesCount: (...args: unknown[]) =>
    getOpenDeficienciesCount(...args),
}));
vi.mock("@/modules/monthly-forms/monthlyForm.controller", () => ({
  listMonthlyForms: (...args: unknown[]) => listMonthlyForms(...args),
}));

import { ForbiddenError } from "@/lib/auth/access";
import { EMPTY_NAV_BADGES, getNavBadges } from "@/lib/nav-badges";
import type { SessionContext } from "@/lib/auth/session";

function session(overrides: {
  role: string;
  vesselId: string | null;
}): SessionContext {
  return {
    session: { id: "s1" },
    user: {
      id: "u1",
      email: "u@example.invalid",
      name: "Test",
      role: overrides.role,
      vesselId: overrides.vesselId,
    },
  } as unknown as SessionContext;
}

describe("getNavBadges", () => {
  beforeEach(() => {
    getAlerts.mockReset();
    getOpenDeficienciesCount.mockReset();
    listMonthlyForms.mockReset();
  });

  it("returns empty badges when getAlerts throws ForbiddenError (unassigned vessel)", async () => {
    getAlerts.mockRejectedValue(
      new ForbiddenError(
        "Vessel-scoped role has no assigned vessel — access denied.",
      ),
    );

    const badges = await getNavBadges(
      session({ role: "vessel_user", vesselId: null }),
    );

    expect(badges).toEqual(EMPTY_NAV_BADGES);
    expect(getOpenDeficienciesCount).not.toHaveBeenCalled();
    expect(listMonthlyForms).not.toHaveBeenCalled();
  });

  it("runs badge queries sequentially and aggregates counts", async () => {
    const order: string[] = [];
    getAlerts.mockImplementation(async () => {
      order.push("alerts");
      return [
        { status: "expired" },
        { status: "expiring" },
      ];
    });
    getOpenDeficienciesCount.mockImplementation(async () => {
      order.push("deficiencies");
      return 2;
    });
    listMonthlyForms.mockImplementation(async () => {
      order.push("forms");
      return [{ id: "f1" }];
    });

    const badges = await getNavBadges(
      session({ role: "admin", vesselId: null }),
    );

    expect(order).toEqual(["alerts", "deficiencies", "forms"]);
    expect(badges.certificates).toEqual({ count: 1, tone: "danger" });
    expect(badges.deficiencies).toEqual({ count: 2, tone: "danger" });
    expect(badges.monthlyForms).toEqual({ count: 1, tone: "warning" });
    expect(badges.crew).toBeNull();
  });

  it("re-throws non-Forbidden errors", async () => {
    getAlerts.mockRejectedValue(new Error("db down"));
    await expect(
      getNavBadges(session({ role: "admin", vesselId: null })),
    ).rejects.toThrow("db down");
  });
});
